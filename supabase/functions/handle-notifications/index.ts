import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://sgea.vercel.app";

// ⚠️ Cambiá a true solo para testear — todos los mails van a DEV_EMAIL
const TEST_MODE = false;
const DEV_EMAIL = "n.sarmiento@cine.unt.edu.ar";

// Email del director — destinatario fijo para avales de dirección
const DIRECTOR_EMAIL = "jveiga@cine.unt.edu.ar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── NODEMAILER ──────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html }: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const gUser = Deno.env.get("GMAIL_USER");
  const gPass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gUser || !gPass) throw new Error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD en variables de entorno");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gUser, pass: gPass },
  });

  const recipients = Array.isArray(to) ? to : [to];
  const originalList = recipients.join(", ");

  let finalTo = recipients;
  let finalSubject = subject;
  let finalHtml = html;

  if (TEST_MODE) {
    console.log(`[TEST_MODE] Redirigiendo [${originalList}] → ${DEV_EMAIL}`);
    finalTo = [DEV_EMAIL];
    finalSubject = `[PRUEBA] ${subject}`;
    finalHtml = `<div style="background:#fffbeb;border:1px solid #f59e0b;color:#78350f;padding:14px;margin-bottom:20px;font-family:sans-serif;font-size:13px;border-radius:8px;">
      <strong>⚠️ MODO PRUEBA</strong> — Destinatario(s) real(es): <code>${originalList}</code>
    </div>` + html;
  }

  const info = await transporter.sendMail({
    from: `"Pañol SGEA - Cine UNT" <${gUser}>`,
    to: finalTo.join(", "),
    subject: finalSubject,
    html: finalHtml,
  });

  console.log(`✅ Mail enviado a [${finalTo.join(", ")}] | MessageID: ${info.messageId}`);
  return info;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

// Resuelve email y nombre del alumno
// profiles tiene: id, email, rol, created_at (sin nombre)
// El nombre viene de auth.users user_metadata
async function resolveAlumno(supabase: any, usuario_id: string) {
  let nombre = "Alumno";
  let email = "";

  // 1. Buscar email en profiles
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", usuario_id)
      .single();
    if (profile?.email) {
      email = profile.email;
      nombre = email.split("@")[0]; // fallback hasta tener metadata
    }
  } catch (err) {
    console.error("Error leyendo profiles:", err);
  }

  // 2. Refinar nombre desde auth.users metadata
  try {
    const { data } = await supabase.auth.admin.getUserById(usuario_id);
    if (data?.user?.email && !email) email = data.user.email;
    const meta = data?.user?.user_metadata;
    if (meta?.full_name) nombre = meta.full_name;
    else if (meta?.name) nombre = meta.name;
    else if (meta?.nombre) nombre = meta.nombre;
  } catch (err) {
    console.error("Error leyendo auth.admin:", err);
  }

  return { nombre, email };
}

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

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

// ─── HANDLERS: TABLA solicitudes_alumnos ─────────────────────────────────────

async function handleSolicitudInsert(record: any, supabase: any) {
  const docenteEmail = record.docente_id;
  if (!docenteEmail) {
    console.warn("⚠️ Sin docente_id en solicitud, omitiendo notificación");
    return;
  }

  let alumnoNombre = record.responsable || "Alumno";
  if (record.usuario_id) {
    const resolved = await resolveAlumno(supabase, record.usuario_id);
    if (resolved.nombre) alumnoNombre = resolved.nombre;
  }

  await sendMail({
    to: docenteEmail,
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
       })}
       <p style="font-size:13px;color:#78350f;">Al otorgar el aval asumís la co-responsabilidad del equipamiento.</p>
       ${btn(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`,
      "Al avalar la solicitud, el alumno podrá retirar el equipamiento en el pañol."
    ),
  });
  console.log(`Notificación enviada al docente: ${docenteEmail}`);
}

async function handleSolicitudPendienteDireccion(record: any, alumnoNombre: string) {
  await sendMail({
    to: DIRECTOR_EMAIL,
    subject: "SGEA — Solicitud pendiente de Aval de Dirección",
    html: wrapEmail(
      "#0f172a", "SGEA — Aval de Dirección Requerido",
      `<h2 style="margin-top:0;">Solicitud de Uso Externo requiere su aprobación</h2>
       <p>La solicitud del alumno <b>${alumnoNombre}</b> fue avalada por el docente <b>${record.docente_nombre || "N/D"}</b> y requiere Aval de Dirección para su despacho.</p>
       ${infoBox("#0f172a", "#f8fafc", {
         "Materia / Proyecto": record.materia || "No especificada",
         "Docente responsable": record.docente_nombre || "No especificado",
         "Alumno referente": alumnoNombre,
         "Fecha de inicio": formatFecha(record.fecha_inicio),
       })}
       ${btn(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`
    ),
  });
}

async function handleSolicitudAutorizada(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) { console.warn("⚠️ Sin email de alumno para notificar autorización"); return; }
  await sendMail({
    to: alumnoEmail,
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
       <p style="font-size:13px;color:#166534;">Presentá tu credencial o comprobante digital en el pañol para retirar.</p>
       ${btn(APP_URL, "Ver Comprobante en SGEA")}`,
      "Recordá respetar las fechas y condiciones de devolución."
    ),
  });
}

async function handleSolicitudRechazada(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) return;
  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ❌ Tu solicitud fue Rechazada",
    html: wrapEmail(
      "#e53935", "SGEA — Solicitud Rechazada",
      `<h2 style="margin-top:0;color:#b71c1c;">Solicitud no aprobada</h2>
       <p>Lamentablemente tu solicitud para <b>${record.materia || "N/D"}</b> fue rechazado.</p>
       ${record.observaciones ? `<p><b>Motivo:</b> ${record.observaciones}</p>` : ""}
       <p>Podés comunicarte con el pañol o tu docente para más información.</p>
       ${btn(APP_URL, "Ver detalle en SGEA")}`
    ),
  });
}

// ─── HANDLERS: TABLA reservas ─────────────────────────────────────────────────

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
        `<h2 style="margin-top:0;">Solicitud de equipamiento para uso externo</h2>
         <p>Se registró un pedido que requiere su <b>Aval de Dirección</b>.</p>
         ${infoBox("#0f172a", "#f8fafc", {
           "Materia / Proyecto": materia,
           "Docente solicitante": record.docente_nombre || "No especificado",
           "Fecha de inicio": formatFecha(record.fecha_inicio),
         })}
         ${btn(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`
      ),
    });
    console.log("Notificación enviada a Dirección (reserva externa)");
  }

  if (tieneDocenteAval && !esAutoAval) {
    let alumnoNombre = record.alumno_nombre || "Un alumno";
    if (record.usuario_id) {
      const resolved = await resolveAlumno(supabase, record.usuario_id);
      if (resolved.nombre) alumnoNombre = resolved.nombre;
    }
    await sendMail({
      to: record.docente_aval_email,
      subject: "SGEA — Pedido de Aval Docente pendiente",
      html: wrapEmail(
        "#f59e0b", "SGEA — Aval Docente Requerido",
        `<h2 style="margin-top:0;color:#78350f;">Solicitud de aval pendiente</h2>
         <p>El alumno <b>${alumnoNombre}</b> solicita equipamiento bajo tu responsabilidad académica.</p>
         ${infoBox("#f59e0b", "#fffbeb", {
           "Materia / Cátedra": materia,
           "Fecha de uso": formatFecha(record.fecha_inicio),
         })}
         ${btn(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`,
        "Al avalar la reserva asumís la co-responsabilidad del equipamiento."
      ),
    });
    console.log(`Notificación enviada al docente: ${record.docente_aval_email}`);
  }
}

async function handleReservaAvalada(record: any, supabase: any) {
  if (!record.usuario_id) { console.warn("⚠️ Sin usuario_id en reserva avalada"); return; }
  const { nombre: alumnoNombre, email: alumnoEmail } = await resolveAlumno(supabase, record.usuario_id);
  if (!alumnoEmail) { console.warn("⚠️ Sin email resuelto para alumno"); return; }

  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ✅ Tu reserva fue Avalada",
    html: wrapEmail(
      "#22c55e", "SGEA — Reserva Avalada",
      `<h2 style="margin-top:0;color:#166534;">¡Buenas noticias, ${alumnoNombre}!</h2>
       <p>Tu reserva de equipos fue avalada. Podés presentarte en el pañol para retirarlos.</p>
       ${infoBox("#22c55e", "#f0fdf4", {
         "Materia": record.materia || "No especificada",
         "Fecha de entrega": formatFecha(record.fecha_inicio),
         "Estado": "LISTO PARA DESPACHO / PAÑOL",
       })}
       ${btn(APP_URL, "Ver Comprobante en SGEA")}`,
      "Presentá tu credencial o comprobante digital en el pañol para retirar."
    ),
  });
  console.log(`Confirmación de aval enviada a alumno: ${alumnoEmail}`);
}

// ─── SERVE ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "HEAD") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  let payload: any;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("Content-Type no es application/json");
    }
    payload = await req.json();
  } catch (parseError: any) {
    console.error("Error parseando payload:", parseError.message);
    return new Response(JSON.stringify({ error: `Payload inválido: ${parseError.message}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { record: newRecord, old_record: oldRecord, type, table } = payload;

    if (!newRecord) {
      return new Response(JSON.stringify({ success: true, message: "Sin record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    console.log(`[SGEA] Evento=${type} | Tabla=${table} | ID=${newRecord.id}`);

    if (table === "solicitudes_alumnos") {
      let alumnoNombre = newRecord.responsable || "Alumno";
      let alumnoEmail = "";

      if (newRecord.usuario_id) {
        const resolved = await resolveAlumno(supabase, newRecord.usuario_id);
        if (resolved.email) alumnoEmail = resolved.email;
        if (resolved.nombre) alumnoNombre = resolved.nombre;
      }

      if (type === "INSERT") {
        await handleSolicitudInsert(newRecord, supabase);
      }

      if (type === "UPDATE" &&
          oldRecord?.estado !== "Pendiente de Dirección" &&
          newRecord.estado === "Pendiente de Dirección") {
        await handleSolicitudPendienteDireccion(newRecord, alumnoNombre);
      }

      if (type === "UPDATE" &&
          oldRecord?.estado !== "Autorizado para Despacho" &&
          newRecord.estado === "Autorizado para Despacho") {
        await handleSolicitudAutorizada(newRecord, alumnoNombre, alumnoEmail);
      }

      if (type === "UPDATE" &&
          oldRecord?.estado !== "Rechazado" &&
          newRecord.estado === "Rechazado") {
        await handleSolicitudRechazada(newRecord, alumnoNombre, alumnoEmail);
      }
    }

    if (table === "reservas" || !table) {
      if (type === "INSERT") {
        await handleReservaInsert(newRecord, supabase);
      }

      if (type === "UPDATE" &&
          oldRecord?.estado === "Pendiente" &&
          newRecord.estado === "Avalada") {
        await handleReservaAvalada(newRecord, supabase);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });

  } catch (error: any) {
    console.error("❌ Error fatal:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  }
});
