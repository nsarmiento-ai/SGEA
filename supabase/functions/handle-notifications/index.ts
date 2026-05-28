import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://sgea.vercel.app";

// ⚠️ TEST_MODE = true → todos los mails van a DEV_EMAIL (para probar sin spam)
// Cambiá a false cuando confirmes que los mails llegan bien
const TEST_MODE = true;
const DEV_EMAIL = "n.sarmiento@cine.unt.edu.ar";

const DIRECTOR_EMAIL = "jveiga@cine.unt.edu.ar";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatFecha(fechaRaw: any): string {
  if (!fechaRaw) return "A coordinar / Consultar en Sistema";
  try {
    const date = new Date(fechaRaw);
    if (isNaN(date.getTime())) return "A coordinar / Consultar en Sistema";
    return date.toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Tucuman",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "A coordinar / Consultar en Sistema";
  }
}

async function sendMail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const gUser = Deno.env.get("GMAIL_USER");
  const gPass = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!gUser || !gPass) {
    throw new Error("Faltan variables de entorno: GMAIL_USER o GMAIL_APP_PASSWORD");
  }

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
    console.log(`[TEST_MODE] Redirigiendo de [${originalList}] → ${DEV_EMAIL}`);
    finalTo = [DEV_EMAIL];
    finalSubject = `[MODO PRUEBA] ${subject}`;
    finalHtml =
      `<div style="background:#fffbeb;border:1px solid #f59e0b;color:#78350f;padding:14px;margin-bottom:20px;font-family:sans-serif;font-size:13px;border-radius:8px;">
        <strong>⚠️ MODO PRUEBA ACTIVO</strong><br>
        Destinatario(s) original(es): <code>${originalList}</code>
      </div>` + html;
  }

  const info = await transporter.sendMail({
    from: `"Pañol de Equipamiento SGEA" <${gUser}>`,
    to: finalTo.join(", "),
    subject: finalSubject,
    html: finalHtml,
  });

  console.log(`✅ Mail enviado. MessageID: ${info.messageId}`);
  return info;
}

// Resuelve email y nombre del alumno desde auth.users
async function resolveAlumno(supabase: any, usuario_id: string) {
  let nombre = "Alumno";
  let email = "";
  try {
    const { data, error } = await supabase.auth.admin.getUserById(usuario_id);
    if (!error && data?.user) {
      email = data.user.email || "";
      nombre =
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.nombre ||
        data.user.user_metadata?.name ||
        email.split("@")[0];
    }
  } catch (err) {
    console.error("Error resolviendo alumno:", err);
  }
  return { nombre, email };
}

// ─── TEMPLATES HTML ──────────────────────────────────────────────────────────

const wrapEmail = (header: { bg: string; title: string }, body: string, footer: string) => `
  <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:${header.bg};color:white;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;">${header.title}</h1>
    </div>
    <div style="padding:32px;color:#1e293b;line-height:1.6;">${body}</div>
    <div style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
      ${footer}
    </div>
  </div>
`;

const btnPrimary = (url: string, label: string) =>
  `<div style="text-align:center;margin-top:32px;">
    <a href="${url}" style="background:#0f172a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">${label}</a>
  </div>`;

const infoBlock = (items: Record<string, string>) => {
  const rows = Object.entries(items)
    .map(([k, v]) => `<p style="margin:8px 0;"><b>${k}:</b> ${v}</p>`)
    .join("");
  return `<div style="background:#f8fafc;border-left:4px solid #0f172a;padding:20px;margin:24px 0;">${rows}</div>`;
};

// ─── HANDLERS POR CASO ───────────────────────────────────────────────────────

// 1. Alumno crea solicitud → notificar al docente
async function notifyDocenteNewRequest(record: any, alumnoNombre: string) {
  const teacherEmail = record.docente_id; // docente_id guarda el email del docente
  if (!teacherEmail) {
    console.log("⚠️ Sin docente_id, omitiendo notificación a docente");
    return;
  }

  await sendMail({
    to: teacherEmail,
    subject: "SGEA — Solicitud de Aval Docente pendiente",
    html: wrapEmail(
      { bg: "#f59e0b", title: "SGEA — Aval Docente Requerido" },
      `<h2 style="margin-top:0;color:#78350f;">Nueva solicitud de alumno</h2>
       <p>El alumno <b>${alumnoNombre}</b> solicita tu aval para retirar equipamiento.</p>
       ${infoBlock({
         "Materia / Cátedra": record.materia || "No especificada",
         "Tipo de uso": record.tipo_uso || "No especificado",
         "Fecha de inicio": formatFecha(record.fecha_inicio),
         "Fecha de devolución": formatFecha(record.fecha_fin),
       })}
       <p style="font-size:13px;color:#78350f;">Al otorgar el aval, asumís la co-responsabilidad del equipamiento.</p>
       ${btnPrimary(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`,
      "Sistema de Gestión de Equipamiento Audiovisual — UNT"
    ),
  });
}

// 2. Docente avala → uso externo → notificar al Director
async function notifyDirectorPendingDireccion(record: any, alumnoNombre: string) {
  await sendMail({
    to: DIRECTOR_EMAIL,
    subject: "SGEA — Solicitud pendiente de Aval de Dirección",
    html: wrapEmail(
      { bg: "#0f172a", title: "SGEA — Aval de Dirección Requerido" },
      `<h2 style="margin-top:0;">Solicitud de Uso Externo requiere su aprobación</h2>
       <p>La solicitud del alumno <b>${alumnoNombre}</b> fue avalada por el docente <b>${record.docente_nombre || "N/D"}</b> y requiere Aval de Dirección para su despacho.</p>
       ${infoBlock({
         "Materia / Proyecto": record.materia || "No especificada",
         "Docente responsable": record.docente_nombre || "No especificado",
         "Alumno referente": alumnoNombre,
         "Fecha de inicio": formatFecha(record.fecha_inicio),
       })}
       ${btnPrimary(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`,
      "Sistema de Gestión de Equipamiento Audiovisual — UNT"
    ),
  });
}

// 3. Solicitud aprobada → notificar al alumno
async function notifyAlumnoAutorizado(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) {
    console.log("⚠️ Sin email de alumno, omitiendo notificación");
    return;
  }

  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ✅ Tu solicitud fue Autorizada para Despacho",
    html: wrapEmail(
      { bg: "#22c55e", title: "SGEA — Solicitud Autorizada" },
      `<h2 style="margin-top:0;color:#166534;">¡Buenas noticias, ${alumnoNombre}!</h2>
       <p>Tu solicitud de equipamiento fue aprobada y está <b>lista para retiro en el pañol</b>.</p>
       ${infoBlock({
         "Materia": record.materia || "No especificada",
         "Fecha de inicio": formatFecha(record.fecha_inicio),
         "Estado": "✅ AUTORIZADO PARA DESPACHO",
       })}
       <p style="font-size:13px;color:#166534;">Presentá tu credencial o comprobante digital en el pañol para retirar.</p>
       ${btnPrimary(APP_URL, "Ver Comprobante en SGEA")}`,
      "Recordá respetar las fechas y condiciones de devolución."
    ),
  });
}

// 4. Solicitud rechazada → notificar al alumno
async function notifyAlumnoRechazado(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) return;

  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ❌ Tu solicitud fue Rechazada",
    html: wrapEmail(
      { bg: "#e53935", title: "SGEA — Solicitud Rechazada" },
      `<h2 style="margin-top:0;color:#b71c1c;">Solicitud no aprobada</h2>
       <p>Lamentablemente tu solicitud para la materia <b>${record.materia || "N/D"}</b> fue rechazada.</p>
       ${record.observaciones ? `<p><b>Motivo:</b> ${record.observaciones}</p>` : ""}
       <p>Podés comunicarte con el pañol o con tu docente para más información.</p>
       ${btnPrimary(APP_URL, "Ver detalle en SGEA")}`,
      "Sistema de Gestión de Equipamiento Audiovisual — UNT"
    ),
  });
}

// 5. Reserva de docente con [Requiere Aval de Dirección] → notificar Director
async function notifyDirectorReservaExterna(record: any) {
  await sendMail({
    to: DIRECTOR_EMAIL,
    subject: "SGEA — Nueva Solicitud de Uso Externo / Especial",
    html: wrapEmail(
      { bg: "#0f172a", title: "SGEA — Aval de Dirección Requerido" },
      `<h2 style="margin-top:0;">Solicitud de equipamiento para uso externo</h2>
       <p>Se registró un pedido que requiere su <b>Aval de Dirección</b>.</p>
       ${infoBlock({
         "Materia / Proyecto": record.materia || "No especificada",
         "Docente solicitante": record.docente_nombre || "No especificado",
         "Fecha de inicio": formatFecha(record.fecha_inicio),
       })}
       ${btnPrimary(`${APP_URL}/autorizaciones`, "Ver y Autorizar en Panel")}`,
      "Sistema de Gestión de Equipamiento Audiovisual — UNT"
    ),
  });
}

// 6. Reserva de docente avalada → notificar al alumno/docente
async function notifyReservaAvalada(record: any, alumnoNombre: string, alumnoEmail: string) {
  if (!alumnoEmail) {
    console.log("⚠️ Sin email resuelto para reserva avalada");
    return;
  }
  await sendMail({
    to: alumnoEmail,
    subject: "SGEA — ✅ Tu reserva fue Avalada",
    html: wrapEmail(
      { bg: "#22c55e", title: "SGEA — Reserva Avalada" },
      `<h2 style="margin-top:0;color:#166534;">¡Buenas noticias, ${alumnoNombre}!</h2>
       <p>Tu reserva de equipos fue avalada. Podés pasar a retirarlos al pañol según el cronograma.</p>
       ${infoBlock({
         "Materia": record.materia || "No especificada",
         "Fecha de entrega": formatFecha(record.fecha_inicio),
         "Estado": "LISTO PARA DESPACHO / PAÑOL",
       })}
       ${btnPrimary(APP_URL, "Ver Comprobante en SGEA")}`,
      "Presentá tu credencial o comprobante digital en el pañol para retirar."
    ),
  });
}

// ─── SERVE ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = await req.json();
    const { record: newRecord, old_record: oldRecord, type, table } = payload;

    console.log(`[SGEA] Event=${type} | Table=${table} | ID=${newRecord?.id}`);

    if (!newRecord) {
      return new Response(JSON.stringify({ message: "Sin record en payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── TABLA: solicitudes_alumnos ────────────────────────────────AAAAAAAA─
    if (table === "solicitudes_alumnos") {
      // Resolver alumno (usuario_id puede no existir si el alumno no está en auth)
      let alumnoNombre = newRecord.responsable || "Alumno";
      let alumnoEmail = "";

      if (newRecord.usuario_id) {
        const resolved = await resolveAlumno(supabase, newRecord.usuario_id);
        if (resolved.email) alumnoEmail = resolved.email;
        if (resolved.nombre) alumnoNombre = resolved.nombre;
      }

      // INSERT → alumno crea solicitud → notificar docente
      if (type === "INSERT") {
        await notifyDocenteNewRequest(newRecord, alumnoNombre);
      }

      // UPDATE: docente avala, uso externo → notificar director
      if (
        type === "UPDATE" &&
        oldRecord?.estado !== "Pendiente de Dirección" &&
        newRecord.estado === "Pendiente de Dirección"
      ) {
        await notifyDirectorPendingDireccion(newRecord, alumnoNombre);
      }

      // UPDATE: aprobado para despacho → notificar alumno
      if (
        type === "UPDATE" &&
        oldRecord?.estado !== "Autorizado para Despacho" &&
        newRecord.estado === "Autorizado para Despacho"
      ) {
        await notifyAlumnoAutorizado(newRecord, alumnoNombre, alumnoEmail);
      }

      // UPDATE: rechazado → notificar alumno
      if (
        type === "UPDATE" &&
        oldRecord?.estado !== "Rechazado" &&
        newRecord.estado === "Rechazado"
      ) {
        await notifyAlumnoRechazado(newRecord, alumnoNombre, alumnoEmail);
      }
    }

    // ── TABLA: reservas ────────────────────────────────────────────────────
    if (table === "reservas" || !table) {
      // Resolver alumno desde auth
      let alumnoNombre = newRecord.alumno_nombre || newRecord.docente_nombre || "Usuario";
      let alumnoEmail = "";

      if (newRecord.usuario_id) {
        const resolved = await resolveAlumno(supabase, newRecord.usuario_id);
        if (resolved.email) alumnoEmail = resolved.email;
        if (resolved.nombre && !newRecord.alumno_nombre) alumnoNombre = resolved.nombre;
      }

      // INSERT con [Requiere Aval de Dirección] → notificar Director
      if (
        type === "INSERT" &&
        (newRecord.materia || "").includes("[Requiere Aval de Dirección]")
      ) {
        await notifyDirectorReservaExterna(newRecord);
      }

      // INSERT de alumno (tiene docente_aval_email) → notificar docente
      if (
        type === "INSERT" &&
        newRecord.docente_aval_email &&
        !(newRecord.materia || "").includes("[Auto-Aval Docente]")
      ) {
        await sendMail({
          to: newRecord.docente_aval_email,
          subject: "SGEA — Tienes un pedido de Aval de Alumno pendiente",
          html: wrapEmail(
            { bg: "#f59e0b", title: "SGEA — Aval Docente Requerido" },
            `<h2 style="margin-top:0;color:#78350f;">Solicitud de aval pendiente</h2>
             <p>El alumno <b>${alumnoNombre}</b> solicita equipamiento bajo tu responsabilidad académica.</p>
             ${infoBlock({
               "Materia / Cátedra": newRecord.materia || "No especificada",
               "Fecha de uso": formatFecha(newRecord.fecha_inicio),
             })}
             ${btnPrimary(`${APP_URL}/mis-autorizaciones`, "Revisar y Otorgar Aval")}`,
            "Al avalar la reserva asumís la co-responsabilidad del equipamiento."
          ),
        });
      }

      // UPDATE: Pendiente → Avalada → notificar alumno
      if (
        type === "UPDATE" &&
        oldRecord?.estado === "Pendiente" &&
        newRecord.estado === "Avalada"
      ) {
        await notifyReservaAvalada(newRecord, alumnoNombre, alumnoEmail);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ Error fatal en webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Siempre 200 para que Supabase no reintente infinitamente
    });
  }
});
