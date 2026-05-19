
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Resend } from "npm:resend"

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const APP_URL = "https://sgea.vercel.app";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const payload = await req.json()
    
    // Supabase Webhook payload structure: 
    // { record: any, old_record: any, type: 'INSERT' | 'UPDATE' | 'DELETE', table: string, schema: string }
    const { record: newRecord, old_record: oldRecord, type } = payload
    
    console.log(`Processing ${type} for record ${newRecord?.id}`);

    // --- CASE A & B: NEW RESERVATIONS (INSERT) ---
    if (type === 'INSERT') {
      const isExternal = (newRecord.materia || '').includes('[Requiere Aval de Dirección]');
      const isStudentReq = newRecord.alumno_nombre && !(newRecord.materia || '').includes('[Auto-Aval Docente]');
      
      // CASE B: Requires Director Approval
      if (isExternal) {
        try {
          await resend.emails.send({
            from: 'SGEA Cine UNT <notificaciones@cine.unt.edu.ar>',
            to: ['director@cine.unt.edu.ar'],
            subject: 'SGEA - Acción Requerida: Solicitud de Uso Externo / Especial',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: #0f172a; color: white; padding: 24px; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px;">SGEA - Escuela de Cine</h1>
                </div>
                <div style="padding: 32px; color: #1e293b; line-height: 1.6;">
                  <h2 style="margin-top: 0; color: #0f172a;">Nueva Solicitud Pendiente de Aval</h2>
                  <p>Se ha registrado un pedido que requiere <b>Aval de Dirección</b> para su procesamiento.</p>
                  <div style="background: #f8fafc; border-left: 4px solid #0f172a; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0;"><b>Materia:</b> ${newRecord.materia}</p>
                    <p style="margin: 8px 0;"><b>Docente:</b> ${newRecord.docente_nombre}</p>
                    <p style="margin: 8px 0 0 0;"><b>Fecha Inicio:</b> ${new Date(newRecord.fecha_inicio).toLocaleDateString()}</p>
                  </div>
                  <div style="text-align: center; margin-top: 32px;">
                    <a href="${APP_URL}/autorizaciones" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver y Autorizar en Panel</a>
                  </div>
                </div>
                <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
                  Sistema de Gestión de Equipamiento Audiovisual - UNT
                </div>
              </div>
            `
          });
          console.log('Director notification sent');
        } catch (e) {
          console.error('Error sending Director notification:', e);
        }
      }

      // CASE A: Student Request notifying Teacher
      if (isStudentReq) {
        // We use docente_aval_email if provided, fallback to docente_id (often used as email in this app)
        const teacherEmail = newRecord.docente_aval_email || newRecord.docente_id;
        if (teacherEmail) {
          try {
            await resend.emails.send({
              from: 'SGEA Cine UNT <notificaciones@cine.unt.edu.ar>',
              to: [teacherEmail],
              subject: 'SGEA - Tienes un pedido de Aval de Alumno pendiente',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #fef3c7; border-radius: 12px; overflow: hidden;">
                  <div style="background: #f59e0b; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">SGEA - Aval Docente</h1>
                  </div>
                  <div style="padding: 32px; color: #451a03; line-height: 1.6;">
                    <h2 style="margin-top: 0;">Solicitud de Aval Pendiente</h2>
                    <p>El alumno <b>${newRecord.alumno_nombre}</b> ha solicitado equipos bajo su responsabilidad para la materia <b>${newRecord.materia}</b>.</p>
                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0;">
                      <p style="margin: 0;"><b>Docente Responsable:</b> ${newRecord.docente_nombre}</p>
                      <p style="margin: 8px 0;"><b>Equipos:</b> Ver detalle en sistema</p>
                      <p style="margin: 8px 0 0 0;"><b>Fecha de Uso:</b> ${new Date(newRecord.fecha_inicio).toLocaleDateString()}</p>
                    </div>
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${APP_URL}/mis-autorizaciones" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Revisar Solicitud</a>
                    </div>
                  </div>
                </div>
              `
            });
            console.log('Teacher notification sent');
          } catch (e) {
            console.error('Error sending Teacher notification:', e);
          }
        }
      }
    }

    // --- CASE C: AVAL GRANTED (UPDATE) ---
    if (type === 'UPDATE' && oldRecord.estado === 'Pendiente' && newRecord.estado === 'Avalada') {
      try {
        // Fetch student email from auth metadata
        const { data: userData } = await supabase.auth.admin.getUserById(newRecord.usuario_id);
        const studentEmail = userData?.user?.email;

        if (studentEmail) {
          await resend.emails.send({
            from: 'SGEA Cine UNT <notificaciones@cine.unt.edu.ar>',
            to: [studentEmail],
            subject: 'SGEA - Tu reserva ha sido AVALADA',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #dcfce7; border-radius: 12px; overflow: hidden;">
                <div style="background: #22c55e; color: white; padding: 24px; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px;">SGEA - Reserva de Equipos</h1>
                </div>
                <div style="padding: 32px; color: #14532d; line-height: 1.6;">
                  <h2 style="margin-top: 0;">¡Buenas noticias!</h2>
                  <p>Tu solicitud de equipos para <b>${newRecord.materia}</b> ha sido avalada satisfactoriamente.</p>
                  <p>Ya puedes presentarte en el pañol en el día y horario solicitado para retirar los recursos.</p>
                  <div style="background: #f0fdf4; border: 1px dashed #22c55e; padding: 20px; margin: 24px 0; border-radius: 8px;">
                    <p style="margin: 0;"><b>Responsable:</b> ${newRecord.alumno_nombre || newRecord.docente_nombre}</p>
                    <p style="margin: 8px 0 0 0;"><b>Estado:</b> LISTO PARA DESPACHO</p>
                  </div>
                  <div style="text-align: center; margin-top: 32px;">
                    <a href="${APP_URL}" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Comprobante</a>
                  </div>
                </div>
              </div>
            `
          });
          console.log('Student notification sent');
        }
      } catch (e) {
        console.error('Error sending student confirmation:', e);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    console.error('Fatal Webhook Error:', error);
    // Always return 200 to Supabase to avoid webhook retry loops if its a logic error
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})

