import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://sgea.vercel.app";

const TEST_MODE = false;
const DEV_EMAIL = "n.sarmiento@cine.unt.edu.ar";
const DIRECTOR_EMAIL = "jveiga@cine.unt.edu.ar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendMail({ to, cc, subject, html }: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
}) {
  const gUser = Deno.env.get("GMAIL_USER");
  const gPass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gUser || !gPass) throw new Error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gUser, pass: gPass },
  });

  let finalTo = Array.isArray(to) ? to.join(", ") : to;
  let finalCc = cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined;
  let finalSubject = subject;
  let finalHtml = html;

  if (TEST_MODE) {
    console.log(`[TEST_MODE] Redirigiendo a ${DEV_EMAIL}. Original To: [${finalTo}], CC: [${finalCc}]`);
    finalTo = DEV_EMAIL;
    finalCc = undefined;
    finalSubject = `[PRUEBA] ${subject}`;
    finalHtml = `<div style="background:#fffbeb;border:1px solid #f59e0b;color:#78350f;padding:14px;margin-bottom:20px;font-family:sans-serif;font-size:13px;border-radius:8px;">
      <strong>⚠️ MODO PRUEBA</strong><br>
      <b>Destinatario Real:</b> <code>${finalTo}</code><br>
      <b>En Copia Real:</b> <code>${finalCc || 'Ninguno'}</code>
    </div>` + html;
  }

  const info = await transporter.sendMail({
    from: `"Pañol SGEA - Cine UNT" <${gUser}>`,
    to: finalTo,
    cc: finalCc,
    subject: finalSubject,
    html: finalHtml,
  });

  console.log(`✅ Mail enviado a [${finalTo}] | CC: [${finalCc || 'ninguno'}] | MessageID: ${info.messageId}`);
  return info;
}

function formatFecha(fechaRaw: any): string {
  if (!fechaRaw) return "A confirmar en el sistema";
  try {
    const date = new Date(fechaRaw);
    if (isNaN(date.getTime())) return "A confirmar en el sistema";
    return date.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Tucuman",
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "A confirmar en el sistema"; }
}

async function resolveAlumno(supabase: any, usuario_id: string) {
  let nombre = "Alumno";
  let email = "";

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", usuario_id)
      .single();
    if (profile?.email) {
      email = profile.email;
      nombre = email.split("@")[0];
    }
  } catch (err) { console.error("Error leyendo profiles:", err); }

  try {
    const { data } = await supabase.auth.admin.getUserById(usuario_id);
    if (data?.user?.email && !email) email = data.user.email;
    const meta = data?.user?.user_metadata;
    if (meta?.full_name) nombre = meta.full_name;
    else if (meta?.name) nombre = meta.name;
    else if (meta?.nombre) nombre = meta.nombre;
  } catch (err) { console.error("Error leyendo auth.admin:", err); }

  return { nombre, email };
}

const wrapEmail = (headerBg: string, headerTitle: string, body: string, footer = "Sistema de Gestión de Equipamiento Audiovisual — UNT") => `
  <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:${headerBg};color:white;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;">${headerTitle}</h1>
    </div>
    <div style="padding:32px;color:#1e293b;line-height:1.6;">${body}</div>
    <div style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">${footer}</div>
  </div>`;

const infoBox = (borderColor: string, bgColor: string, items: Record<string, string>) =>
  `<div style="background:${bgColor};border-left:4px solid ${borderColor};padding:20px;margin:24px 0;">
    ${Object.entries(items).map(([k, v]) => `<p style="margin:6px 0;"><b>${k}:</b> ${v}</p>`).join("")}
  </div>`;

const btn = (url: string, label: string) =>
  `<div style="text-align:center;margin-top:32px;">
    <a href="${url}" style="background:#0f172a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">${label}</a>
  </div>`;

async function handleSolicitudInsert(record: any, supabase: any) {
  const docenteEmail = record.docente_id;
  if (!docenteEmail) return;

  let alumnoNombre = record.responsable || "Alumno";
  let alumnoEmail = "";
  if (record.usuario_id) {
    const resolved = await resolveAlumno(supabase, record.usuario_id);
    if (resolved.nombre) alumnoNombre = resolved.nombre;
    if (resolved.email) alumnoEmail = resolved.email;
  }

  // Notifica al docente, con copia al alumno y participantes si existen
  const copiaCorreos = [alumnoEmail, record.participantes].filter(Boolean);

  await sendMail({
    to: docenteEmail,
    cc: copiaCorreos.length > 0 ? copiaCorreos : undefined,
    subject: "SGEA — Nueva solicitud de Aval Docente pendiente",
    html: wrapEmail(
      "#f59e0b", "SGEA — Aval Docente Requerido",
      `<h2 style="margin-top:0;color:#78350f;">Solicitud de equipamiento pendiente</h2>
       <p>El alumno <b>${alumnoNombre}</b> solicita tu aval para retirar equipamiento del pañol.</p>
       ${infoBox("#f59e0b", "#fffbeb", {
         "Materia / Cátedra": record.materia || "No especificada",
         "Tipo de uso": record.tipo_uso || "No especificado",
         "Fecha de inicio": formatFecha(record.fecha_inicio),
         "Fecha de devolución": formatFecha(record.fecha_fin),
         "Participantes": record.participantes || "Ninguno"
       })}
       ${btn(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`
    ),
  });
}

async function handleSolicitudPendienteDireccion(record: any, alumnoNombre: string, alumnoEmail: string) {
  const copiaCorreos = [alumnoEmail, record.participantes].filter(Boolean);
  await sendMail({
    to: DIRECTOR_EMAIL,
    cc: copiaCorreos.length > 0 ? copiaCorreos : undefined,
    subject: "SGEA — Solicitud pendiente de Aval de Dirección",
    html: wrapEmail(
      "#0f172a", "SGEA — Aval de Dirección Requerido",
      `<h2 style="margin-top:0;">Solicitud requiere Aval de Dirección</h2>
       <p>La solicitud de <b>${alumnoNombre}</b> fue avalada por el docente y requiere aprobación de Dirección.</p>
       ${infoBox("#0f172a", "#f8fafc", {
         "Materia / Proyecto": record.materia || "No especificada",
         "Alumno referente": alumnoNombre,
         "Fecha de inicio": formatFecha(record.fecha_inicio),
       })}
       ${btn(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`
    ),
  });
}

async function handleSolicitudAutorizada(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) return;
  const copiaCorreos = [record.participantes].filter(Boolean);
  await sendMail({
    to: alumnoEmail,
    cc: copiaCorreos.length > 0 ? copiaCorreos : undefined,
    subject: "SGEA — ✅ Tu solicitud fue Autorizada para Despacho",
    html: wrapEmail(
      "#22c55e", "SGEA — Solicitud Autorizada",
      `<h2 style="margin-top:0;color:#166534;">¡Buenas noticias, ${alumnoNombre}!</h2>
       <p>Tu solicitud fue aprobada y está <b>lista para retiro en el pañol</b>.</p>
       ${infoBox("#22c55e", "#f0fdf4", {
         "Materia": record.materia || "No especificada",
         "Fecha de inicio": formatFecha(record.fecha_inicio),
         "Estado": "✅ AUTORIZADO PARA DESPACHO",
       })}
       ${btn(APP_URL, "Ver Comprobante en SGEA")}`
    ),
  });
}

async function handleSolicitudRechazada(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) return;
  const copiaCorreos = [record.participantes].filter(Boolean);
  await sendMail({
    to: alumnoEmail,
    cc: copiaCorreos.length > 0 ? copiaCorreos : undefined,
    subject: "SGEA — ❌ Tu solicitud fue Rechazada",
    html: wrapEmail(
      "#e53935", "SGEA — Solicitud Rechazada",
      `<h2 style="margin-top:0;color:#b71c1c;">Solicitud no aprobada</h2>
       <p>Lamentablemente tu solicitud para <b>${record.materia || 'N/D'}</b> fue rechazada.</p>
       ${record.observaciones ? `<p><b>Motivo:</b> ${record.observaciones}</p>` : ""}
       ${btn(APP_URL, "Ver detalle en SGEA")}`
    ),
  });
}

async function handleReservaInsert(record: any, supabase: any) {
  const materia = record.materia || "";
  const requiereDir = materia.includes("[Requiere Aval de Dirección]");
  const esAutoAval = materia.includes("[Auto-Aval Docente]");
  const tieneDocenteAval = !!record.docente_aval_email;

  if (requiereDir) {
    await sendMail({
      to: DIRECTOR_EMAIL,
      subject: "SGEA — Nueva Solicitud de Uso Externo / Especial",
      html: wrapEmail(
        "#0f172a", "SGEA — Aval de Dirección Requerido",
        `<h2 style="margin-top:0;">Uso externo requiere Aval de Dirección</h2>
         ${infoBox("#0f172a", "#f8fafc", {
           "Materia / Proyecto": materia,
           "Docente solicitante": record.docente_nombre || "No especificado",
         })}
         ${btn(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`
      ),
    });
  }

  if (tieneDocenteAval && !esAutoAval) {
    let alumnoNombre = record.alumno_nombre || "Un alumno";
    let alumnoEmail = "";
    if (record.usuario_id) {
      const resolved = await resolveAlumno(supabase, record.usuario_id);
      if (resolved.nombre) alumnoNombre = resolved.nombre;
      if (resolved.email) alumnoEmail = resolved.email;
    }
    await sendMail({
      to: record.docente_aval_email,
      cc: alumnoEmail ? [alumnoEmail] : undefined,
      subject: "SGEA — Pedido de Aval Docente pendiente",
      html: wrapEmail(
        "#f59e0b", "SGEA — Aval Docente Requerido",
        `<h2 style="margin-top:0;color:#78350f;">Solicitud de aval pendiente</h2>
         <p>El alumno <b>${alumnoNombre}</b> solicita equipamiento bajo tu responsabilidad académica.</p>
         ${infoBox("#f59e0b", "#fffbeb", {
           "Materia / Cátedra": materia,
           "Fecha de uso": formatFecha(record.fecha_inicio),
         })}
         ${btn(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`
      ),
    });
  }
}

async function handleReservaAvalada(record: any, supabase: any) {
  if (!record.usuario_id) return;
  const { nombre: alumnoNombre, email: alumnoEmail } = await resolveAlumno(supabase, record.usuario_id);
  if (!alumnoEmail) return;

  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ✅ Tu reserva fue Avalada",
    html: wrapEmail(
      "#22c55e", "SGEA — Reserva Avalada",
      `<h2 style="margin-top:0;color:#166534;">¡Buenas noticias, ${alumnoNombre}!</h2>
       <p>Tu reserva fue avalada y está lista para despacho en el pañol.</p>
       ${infoBox("#22c55e", "#f0fdf4", {
         "Materia": record.materia || "No especificada",
         "Fecha de entrega": formatFecha(record.fecha_inicio),
       })}
       ${btn(APP_URL, "Ver Comprobante en SGEA")}`
    ),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "HEAD") return new Response(null, { headers: corsHeaders, status: 200 });

  let payload: any;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Payload inválido" }), { headers: corsHeaders, status: 400 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { record: newRecord, old_record: oldRecord, type, table } = payload;

    if (!newRecord) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });

    if (table === "solicitudes_alumnos") {
      let alumnoNombre = newRecord.responsable || "Alumno";
      let alumnoEmail = "";

      if (newRecord.usuario_id) {
        const resolved = await resolveAlumno(supabase, newRecord.usuario_id);
        if (resolved.email) alumnoEmail = resolved.email;
        if (resolved.nombre) alumnoNombre = resolved.nombre;
      }

      if (type === "INSERT") await handleSolicitudInsert(newRecord, supabase);
      
      if (type === "UPDATE" && oldRecord?.estado !== "Pendiente de Dirección" && newRecord.estado === "Pendiente de Dirección") {
        await handleSolicitudPendienteDireccion(newRecord, alumnoNombre, alumnoEmail);
      }
      if (type === "UPDATE" && oldRecord?.estado !== "Autorizado para Despacho" && newRecord.estado === "Autorizado para Despacho") {
        await handleSolicitudAutorizada(newRecord, alumnoNombre, alumnoEmail);
      }
      if (type === "UPDATE" && oldRecord?.estado !== "Rechazado" && newRecord.estado === "Rechazado") {
        await handleSolicitudRechazada(newRecord, alumnoNombre, alumnoEmail);
      }
    }

    if (table === "reservas" || !table) {
      if (type === "INSERT") await handleReservaInsert(newRecord, supabase);
      if (type === "UPDATE" && oldRecord?.estado === "Pendiente" && newRecord.estado === "Avalada") {
        await handleReservaAvalada(newRecord, supabase);
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 200 });
  }
});
