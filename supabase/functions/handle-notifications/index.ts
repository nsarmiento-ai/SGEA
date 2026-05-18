
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = "https://ais-pre-s6pvvbo4hdgmrkhtagmvbx-476524253366.us-east1.run.app"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const payload = await req.json()
    
    const { record: newRecord, old_record: oldRecord, type } = payload
    
    let emailTo = ""
    let subject = ""
    let html = ""

    // LOGIC A: New Reservation requiring Director Approval
    if (type === 'INSERT' && newRecord.estado === 'Pendiente' && newRecord.materia?.includes('[Requiere Aval de Dirección]')) {
      emailTo = "director@cine.unt.edu.ar"
      subject = "SGEA - Acción Requerida: Autorización de Rodaje Externo"
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #0f172a;">Solicitud de Aval de Dirección</h2>
          <p>Se ha registrado un nuevo pedido de equipos para <b>Uso Externo</b> que requiere su revisión técnica.</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><b>Docente:</b> ${newRecord.docente_nombre}</p>
            <p><b>Materia/Proyecto:</b> ${newRecord.materia}</p>
            <p><b>Fecha:</b> ${new Date(newRecord.fecha_inicio).toLocaleDateString()}</p>
          </div>
          <a href="${APP_URL}/autorizaciones" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ingresar al Panel de Dirección</a>
          <p style="font-size: 12px; color: #64748b; margin-top: 30px;">Escuela Universitaria de Cine, Video y Televisión - UNT</p>
        </div>
      `
    }

    // LOGIC B: Aval Granted (Confirmed to Student/Teacher)
    else if (type === 'UPDATE' && oldRecord.estado === 'Pendiente' && newRecord.estado === 'Avalada') {
      // We need to find the student email if it's not in the record
      // For this example, we assume we want to notify the creator of the reservation
      const { data: userData } = await supabase.auth.admin.getUserById(newRecord.usuario_id)
      emailTo = userData?.user?.email || ""
      
      if (emailTo) {
        subject = "SGEA - Tu reserva ha sido Avalada"
        html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #15803d;">¡Reserva Confirmada!</h2>
            <p>Hola, la solicitud para <b>${newRecord.docente_nombre}</b> ha sido avalada por la autoridad correspondiente.</p>
            <p>Ya puedes coordinar el retiro de los equipos en el pañol en las fechas indicadas.</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bcf0da;">
              <p><b>ID de Reserva:</b> ${newRecord.id.slice(0,8)}</p>
              <p><b>Materia:</b> ${newRecord.materia}</p>
            </div>
            <a href="${APP_URL}" style="display: inline-block; background: #15803d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver mis Reservas</a>
          </div>
        `
      }
    }

    // LOGIC C: Student Request requiring Teacher Aval
    // Note: If you use a separate table 'solicitudes_alumnos', this would trigger on that table.
    // Assuming 'reservas' is used for both with a flag:
    else if (type === 'INSERT' && newRecord.estado === 'Pendiente' && !newRecord.materia?.includes('[Auto-Aval Docente]')) {
       // Search for teacher email (docente_id is often the email)
       emailTo = newRecord.docente_id || "" 
       if (emailTo) {
         subject = "SGEA - Tienes un nuevo pedido de Aval de Alumno"
         html = `
           <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
             <h2 style="color: #f59e0b;">Solicitud de Aval Pendiente</h2>
             <p>Un alumno ha registrado una solicitud de equipos bajo su responsabilidad para la materia <b>${newRecord.materia}</b>.</p>
             <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fef3c7;">
               <p><b>Alumno:</b> ${newRecord.alumno_nombre}</p>
               <p><b>Fecha de Uso:</b> ${new Date(newRecord.fecha_inicio).toLocaleDateString()}</p>
             </div>
             <a href="${APP_URL}/mis-autorizaciones" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Revisar y Autorizar</a>
           </div>
         `
       }
    }

    if (emailTo && html) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SGEA Cine UNT <notificaciones@cine.unt.edu.ar>',
          to: [emailTo],
          subject: subject,
          html: html,
        }),
      })

      const resData = await res.json()
      return new Response(JSON.stringify(resData), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      })
    }

    return new Response(JSON.stringify({ message: 'No notification needed' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
