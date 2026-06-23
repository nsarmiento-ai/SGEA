import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, title, and body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys are not configured in environment variables" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const contactEmail = Deno.env.get("GMAIL_USER") || "direccion@cine.unt.edu.ar";
    webpush.setVapidDetails(
      `mailto:${contactEmail}`,
      vapidPublicKey,
      vapidPrivateKey
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get active subscriptions for the user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (fetchError) {
      throw fetchError;
    }

    let sent = 0;
    let removed = 0;

    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        };

        const payload = JSON.stringify({
          title,
          body,
          data: { url: "/mis-autorizaciones" },
        });

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sent++;
        } catch (err: any) {
          console.error(`Error sending push notification to endpoint ${sub.endpoint}:`, err);
          // 410 (Gone) or 404 (Not Found) indicates expired/invalid subscription
          if (err.statusCode === 410 || err.statusCode === 404) {
            const { error: deleteError } = await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);

            if (deleteError) {
              console.error(`Failed to delete obsolete subscription ${sub.id}:`, deleteError);
            } else {
              removed++;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, removed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("❌ send-push-notification Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
