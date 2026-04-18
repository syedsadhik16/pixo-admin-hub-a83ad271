// Edge function stub: stream an admin export to a Google Sheet.
// Backend-ready but inert until GOOGLE_SHEETS_SERVICE_ACCOUNT is configured.
// Invoke with: { exportType: string, rows: any[], sheetId?: string }

import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { exportType, rows = [] } = body;

    const serviceAccount = Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT");
    if (!serviceAccount) {
      return new Response(JSON.stringify({
        ok: false,
        status: "not_configured",
        message: "GOOGLE_SHEETS_SERVICE_ACCOUNT secret not set. Add it to enable live Sheets sync.",
        echo: { exportType, rowCount: rows.length, actor: user.id },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // TODO: When secret is added, implement Google Sheets API push here.
    return new Response(JSON.stringify({
      ok: true,
      status: "stub",
      message: "Service account detected but Sheets push not yet implemented.",
      rowCount: rows.length,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
