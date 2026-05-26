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

// Robust date formatting helper to avoid "Invalid Date"
function formatFecha(fechaRaw: any): string {
  if (!fechaRaw) return "A coordinar / Consultar en Sistema";
  try {
    const date = new Date(fechaRaw);
    if (isNaN(date.getTime())) {
      return "A coordinar / Consultar en Sistema";
    }
    return date.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Tucuman',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (_e) {
    return "A coordinar / Consultar en Sistema";
  }
}

// Helper to safely send email with Resend, bypassing sandbox/onboarding limitations
async function sendWrappedEmail({ to, subject, html }: { to: string[], subject: string, html: string }) {
  // Let the user configure their verified domain email. If not set, default to onboarding@resend.dev
  let fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
  
  // Format visual name
  if (!fromEmail.includes('<')) {
    fromEmail = `SGEA Cine UNT <${fromEmail}>`;
  }

  // Fallback / developer email for testing
  const testRecipient = Deno.env.get('TEST_RECIPIENT_EMAIL') || 'n.sarmiento@cine.unt.edu.ar';
  
  let finalTo = [...to];

  // If we are using the free/onboarding domain, we MUST rewrite recipient to the verified owner address.
  // Resend will throw a 400 Bad Request if we try to send to any unverified address in sandbox.
  if (fromEmail.includes('onboarding@resend.dev')) {
    console.log(`[Resend Sandbox Mode] Overriding recipients ${JSON.stringify(to)} to registered owner address: ${testRecipient}`);
    subject = `[TEST RESEND SANDBOX to ${to.join(', ')}] ` + subject;
    finalTo = [testRecipient];
  } else {
    // Optional CC / duplicate for tracking
    const alwaysCcTest = Deno.env.get('ALWAYS_CC_TEST') === 'true';
    if (alwaysCcTest && !finalTo.includes(testRecipient)) {
      finalTo.push(testRecipient);
    }
  }

  console.log(`Dispatching email -> From: ${fromEmail} | To: ${JSON.stringify(finalTo)} | Subject: ${subject}`);
  
  const result = await resend.emails.send({
    from: fromEmail,
    to: finalTo,
    subject: subject,
    html: html,
  });

  return result;
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
    
    console.log(`Processing webhook: Event=${type}, Table=${payload.table || 'reservas'}, RecordID=${newRecord?.id}`);

    // If there is no record, skip
    if (!newRecord) {
      return new Response(JSON.stringify({ message: 'No record found in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Solve Date format early
    const formattedDate = formatFecha(newRecord.fecha_inicio);

    // --- CASE A & B: NEW RESERVATIONS (INSERT) ---
    if (type === 'INSERT') {
      const isExternal = (newRecord.materia || '').includes('[Requiere Aval de Dirección]');
      const isStudentReq = newRecord.alumno_nombre || !(newRecord.materia || '').includes('[Auto-Aval Docente]');

      // Try to fetch full student user details via auth.admin to resolve name and email if missing
      let resolvedAlumnoNombre = newRecord.alumno_nombre;
      let resolvedAlumnoEmail = "";

      if (newRecord.usuario_id) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(newRecord.usuario_id);
          if (!userError && userData?.user) {
            resolvedAlumnoEmail = userData.user.email || "";
            if (!resolvedAlumnoNombre) {
              resolvedAlumnoNombre = userData.user.user_metadata?.full_name || 
                                     userData.user.user_metadata?.nombre || 
                                     userData.user.user_metadata?.name || 
                                     userData.user.email?.split('@')[0];
            }
          }
        } catch (err) {
          console.error('Error querying student user details:', err);
        }
      }

      // Final fallback if name is still empty
      if (!resolvedAlumnoNombre) {
        resolvedAlumnoNombre = "Un alumno de la materia";
      }

      // CASE B: Requires Director Approval (External / Special use)
      if (isExternal) {
        try {
          await sendWrappedEmail({
            to: ['director@cine.unt.edu.ar'],
            subject: 'SGEA - Acción Requerida: Solicitud de Uso Externo / Especial',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: #0f172a; color: white; padding: 24px; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px;">SGEA - Escuela de Cine</h1>
                </div>
                <div style="padding: 32px; color: #1e293b; line-height: 1.6;">
                  <h2 style="margin-top: 0; color: #0f172a;">Nueva Solicitud Pendiente de Aval</h2>
                  <p>Se ha registrado un pedido de equipos que requiere su evaluación técnica y su correspondiente <b>Aval de Dirección</b>.</p>
                  <div style="background: #f8fafc; border-left: 4px solid #0f172a; padding: 20px; margin: 24px 0;">
                    <p style="margin: 0;"><b>Materia / Proyecto:</b> ${newRecord.materia || 'No especificada'}</p>
                    <p style="margin: 8px 0;"><b>Docente Solicitante:</b> ${newRecord.docente_nombre || 'No especificado'}</p>
                    <p style="margin: 8px 0;"><b>Alumno Referente:</b> ${resolvedAlumnoNombre}</p>
                    <p style="margin: 8px 0 0 0;"><b>Fecha de Inicio Planificada:</b> ${formattedDate}</p>
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
          console.log('Director notification sent successfully');
        } catch (e) {
          console.error('Error sending Director notification:', e);
        }
      }

      // CASE A: Student Request notifying Teacher
      if (isStudentReq) {
        // Find teacher email: docente_aval_email first, fallback to docente_id
        const teacherEmail = newRecord.docente_aval_email || newRecord.docente_id;
        if (teacherEmail) {
          try {
            await sendWrappedEmail({
              to: [teacherEmail],
              subject: 'SGEA - Tienes un pedido de Aval de Alumno pendiente',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #fef3c7; border-radius: 12px; overflow: hidden;">
                  <div style="background: #f59e0b; color: white; padding: 24px; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">SGEA - Aval Docente</h1>
                  </div>
                  <div style="padding: 32px; color: #451a03; line-height: 1.6;">
                    <h2 style="margin-top: 0; color: #78350f;">Solicitud de Aval Pendiente</h2>
                    <p>El alumno <b>${resolvedAlumnoNombre}</b> ha solicitado equipamiento bajo su responsabilidad académica.</p>
                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0;">
                      <p style="margin: 0;"><b>Materia / Cátedra:</b> ${newRecord.materia || 'No especificada'}</p>
                      <p style="margin: 8px 0;"><b>Docente Avalador:</b> ${newRecord.docente_nombre || 'No especificado'}</p>
                      <p style="margin: 8px 0 0 0;"><b>Fecha de Uso:</b> ${formattedDate}</p>
                    </div>
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${APP_URL}/mis-autorizaciones" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Revisar y Otorgar Aval</a>
                    </div>
                  </div>
                  <div style="background: #fffbeb; padding: 16px; text-align: center; font-size: 11px; color: #b45309; border-t: 1px solid #fef3c7;">
                    Recuerde que al avalar la reserva, asume la co-responsabilidad del equipamiento.
                  </div>
                </div>
              `
            });
            console.log('Teacher notification sent successfully');
          } catch (e) {
            console.error('Error sending Teacher notification:', e);
          }
        } else {
          console.log(`Skipping teacher notification: No email specified in docente_aval_email/docente_id. Values were: docente_aval_email=${newRecord.docente_aval_email}, docente_id=${newRecord.docente_id}`);
        }
      }
    }

    // --- CASE C: AVAL GRANTED (UPDATE) ---
    if (type === 'UPDATE' && oldRecord && oldRecord.estado === 'Pendiente' && newRecord.estado === 'Avalada') {
      try {
        // Fetch student email from auth metadata
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(newRecord.usuario_id);
        const studentEmail = userData?.user?.email;

        // Fallback name if missing
        let resolvedAlumnoNombre = newRecord.alumno_nombre;
        if (!resolvedAlumnoNombre && userData?.user) {
          resolvedAlumnoNombre = userData.user.user_metadata?.full_name || 
                                 userData.user.user_metadata?.nombre || 
                                 userData.user.user_metadata?.name || 
                                 userData.user.email?.split('@')[0];
        }
        if (!resolvedAlumnoNombre) {
          resolvedAlumnoNombre = "Alumno de Cátedra";
        }

        if (studentEmail) {
          await sendWrappedEmail({
            to: [studentEmail],
            subject: 'SGEA - Tu reserva ha sido AVALADA',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #dcfce7; border-radius: 12px; overflow: hidden;">
                <div style="background: #22c55e; color: white; padding: 24px; text-align: center;">
                  <h1 style="margin: 0; font-size: 20px;">SGEA - Reserva Avalada</h1>
                </div>
                <div style="padding: 32px; color: #14532d; line-height: 1.6;">
                  <h2 style="margin-top: 0; color: #166534;">¡Buenas noticias, ${resolvedAlumnoNombre}!</h2>
                  <p>Tu solicitud de préstamo de equipos para la materia <b>${newRecord.materia || 'No especificada'}</b> ha sido avalada satisfactoriamente por tu docente.</p>
                  <p>Los equipos están listos para tu retiro en el pañol de la escuela según el cronograma acordado.</p>
                  <div style="background: #f0fdf4; border: 1px dashed #22c55e; padding: 20px; margin: 24px 0; border-radius: 8px;">
                    <p style="margin: 0;"><b>Referente:</b> ${resolvedAlumnoNombre}</p>
                    <p style="margin: 8px 0;"><b>Fecha de Entrega:</b> ${formattedDate}</p>
                    <p style="margin: 8px 0 0 0;"><b>Estado actual:</b> LISTO PARA DESPACHO / PAÑOL</p>
                  </div>
                  <div style="text-align: center; margin-top: 32px;">
                    <a href="${APP_URL}" style="background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Comprobante en SGEA</a>
                  </div>
                </div>
                <div style="background: #f0fdf4; padding: 16px; text-align: center; font-size: 11px; color: #166534; border-t: 1px solid #dcfce7;">
                  Presente su credencial o comprobante digital en el pañol para retirar.
                </div>
              </div>
            `
          });
          console.log('Student notification sent successfully');
        } else {
          console.log(`Skipping student notification: Could not retrieve email for user ID ${newRecord.usuario_id}`);
        }
      } catch (e) {
        console.error('Error sending student confirmation:', e);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: any) {
    console.error('Fatal Webhook Error:', error);
    // Always return 200 to Supabase to avoid webhook retry loops if it's a code/payload error
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})
