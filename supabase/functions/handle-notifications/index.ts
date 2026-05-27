import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import nodemailer from "npm:nodemailer"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const APP_URL = "https://sgea.vercel.app";

// CONSTANTE FIJA DE MODO PRUEBA (Para pruebas en sandbox)
const TEST_MODE = true; // Activo por default para interceptar y redirigir todos los mails al correo del admin
const DEV_EMAIL = "n.sarmiento@cine.unt.edu.ar";

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

// Simple and direct email sender using Nodemailer and Gmail SMTP
async function sendNotificationEmail({ to, subject, html, originalRecipient }: { to: string[], subject: string, html: string, originalRecipient: string }) {
  const gUser = Deno.env.get('GMAIL_USER');
  const gPass = Deno.env.get('GMAIL_APP_PASSWORD');

  if (!gUser || !gPass) {
    throw new Error("Faltan las variables de entorno para Nodemailer: GMAIL_USER o GMAIL_APP_PASSWORD");
  }

  // Configure transporter targeting smtp.gmail.com
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: gUser,
      pass: gPass,
    },
  });

  // Display name is customized, while real address matches authenticating user to prevent SPF/DKIM block
  const fromEmail = `Pañol de Equipamiento SGEA <${gUser}>`;

  let finalTo = [...to];
  let finalHtml = html;
  let finalSubject = subject;

  // Sandbox bypass logic: rewrite recipient to dev address if TEST_MODE is active
  if (TEST_MODE) {
    console.log(`[TEST_MODE] Redirigiendo correo original de ${originalRecipient} al administrador ${DEV_EMAIL}`);
    finalTo = [DEV_EMAIL];
    finalSubject = `[MODO PRUEBA] ${subject}`;
    
    const banner = `
      <div style="background-color: #fffbeb; border: 1px solid #f59e0b; color: #78350f; padding: 14px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; border-radius: 8px;">
        <strong>⚠️ NOTIFICACIÓN EN MODO PRUEBA DE DESARROLLO (SMTP):</strong><br>
        Este correo fue interceptado y redirigido en modo Sandbox.<br>
        <b>Destinatario original del sistema:</b> <code>${originalRecipient}</code>
      </div>
    `;
    finalHtml = banner + html;
  }

  console.log(`Ejecutando envío en Nodemailer -> De: ${fromEmail} | Para: ${JSON.stringify(finalTo)} | Asunto: ${finalSubject}`);

  const info = await transporter.sendMail({
    from: fromEmail,
    to: finalTo.join(", "),
    subject: finalSubject,
    html: finalHtml,
  });

  console.log(`Nodemailer envío completado con éxito. Message ID: ${info.messageId}`);
  return info;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const payload = await req.json()
    
    const { record: newRecord, old_record: oldRecord, type } = payload
    
    console.log(`[SGEA Webhook] Event=${type}, Table=${payload.table || 'reservas'}, RecordID=${newRecord?.id}`);

    if (!newRecord) {
      return new Response(JSON.stringify({ message: 'No record found in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const formattedDate = formatFecha(newRecord.fecha_inicio);

    // Fetch student's real name and email if available via auth.admin
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
        console.error('Error al consultar datos del alumno en Supabase Auth:', err);
      }
    }

    if (!resolvedAlumnoNombre) {
      resolvedAlumnoNombre = "Un alumno de la materia";
    }

    // --- CASO A: SOLICITUD DE ALUMNO QUE NOTIFICA AL DOCENTE (INSERT) ---
    if (type === 'INSERT') {
      const isExternal = (newRecord.materia || '').includes('[Requiere Aval de Dirección]');
      const isStudentReq = newRecord.alumno_nombre || !(newRecord.materia || '').includes('[Auto-Aval Docente]');

      // CASO B: Requiere Aval de Dirección (Uso Externo / Especial)
      if (isExternal) {
        try {
          const directEmail = 'director@cine.unt.edu.ar';
          await sendNotificationEmail({
            to: [directEmail],
            originalRecipient: directEmail,
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
          console.log('Notificación de Dirección procesada con éxito');
        } catch (e) {
          console.error('Error al enviar notificación a Dirección:', e);
        }
      }

      // CASO A: Alumno solicita y se notifica al Docente Avalador
      if (isStudentReq) {
        const teacherEmail = newRecord.docente_aval_email || newRecord.docente_id;
        if (teacherEmail) {
          try {
            await sendNotificationEmail({
              to: [teacherEmail],
              originalRecipient: teacherEmail,
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
            console.log('Notificación de Docente procesada con éxito');
          } catch (e) {
            console.error('Error al enviar notificación a Docente:', e);
          }
        } else {
          console.log(`Omisión de notificación a Docente: docente_aval_email vacío.`);
        }
      }
    }

    // --- CASO C: RESERVA AVALADA POR EL DOCENTE (UPDATE) ---
    if (type === 'UPDATE' && oldRecord && oldRecord.estado === 'Pendiente' && newRecord.estado === 'Avalada') {
      const studentEmail = resolvedAlumnoEmail || "";
      if (studentEmail) {
        try {
          await sendNotificationEmail({
            to: [studentEmail],
            originalRecipient: studentEmail,
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
          console.log('Notificación de Alumno procesada con éxito');
        } catch (e) {
          console.error('Error al enviar confirmación al alumno:', e);
        }
      } else {
        console.log(`Omisión de notificación al Alumno: No se pudo resolver el email del usuario_id ${newRecord.usuario_id}.`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error: any) {
    console.error('Fatal Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  }
})
