import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require CRON_SECRET header (or query) so only cron / admin can invoke
  const expected = Deno.env.get("CRON_SECRET");
  const provided =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("cron_secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoffIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const startedAt = new Date().toISOString();

  try {
    // Find candidates first (so we know how many we touched, and skip rows already 'dropped')
    const { data: candidates, error: selErr } = await supabase
      .from("lead_pipeline")
      .select("id, user_id, stage, last_activity_at")
      .lt("last_activity_at", cutoffIso)
      .not("stage", "in", "(converted,dropped)");

    if (selErr) throw selErr;

    let updated = 0;
    if (candidates && candidates.length > 0) {
      const ids = candidates.map((c) => c.id);
      const { error: updErr } = await supabase
        .from("lead_pipeline")
        .update({ stage: "dropped", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (updErr) throw updErr;
      updated = ids.length;
    }

    // Audit log
    await supabase.from("system_sync_logs").insert({
      sync_type: "auto_drop_stale_leads",
      status: "success",
      payload: { cutoff: cutoffIso, candidates: candidates?.length ?? 0, updated, started_at: startedAt },
    });

    return new Response(
      JSON.stringify({ ok: true, candidates: candidates?.length ?? 0, updated, cutoff: cutoffIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("system_sync_logs").insert({
      sync_type: "auto_drop_stale_leads",
      status: "error",
      payload: { error: msg, started_at: startedAt },
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
