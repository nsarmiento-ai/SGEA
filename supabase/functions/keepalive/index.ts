// SGEA - Keepalive Function
// Propósito: Ejecutar una query liviana para evitar que Supabase pause la DB.
// Apuntar UptimeRobot a: https://<tu-proyecto>.supabase.co/functions/v1/keepalive
// Configurar frecuencia: cada 4 días (Supabase pausa tras 7 días sin actividad)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Responder OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query mínima: solo cuenta 1 fila de audit_logs (tabla que seguro existe)
    // Si querés usar otra tabla cambiala acá
    const { error } = await supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      console.error("Keepalive query error:", error.message);
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ Keepalive OK — ${elapsed}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Base de datos activa",
        elapsed_ms: elapsed,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Keepalive fatal error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
