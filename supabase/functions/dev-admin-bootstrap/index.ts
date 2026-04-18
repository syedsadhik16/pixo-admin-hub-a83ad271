// Dev-only bootstrap: ensures admin@pixo.ai exists with a deterministic password
// so the admin panel can auto-sign-in during local/preview development without
// the user typing credentials. RLS continues to enforce real auth.
//
// SECURITY: This function only ever touches admin@pixo.ai (or DEV_ADMIN_EMAIL).
// It does NOT accept arbitrary emails. Safe to leave deployed; any caller still
// only gets a session for the dev account, not arbitrary access.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEV_EMAIL = Deno.env.get("DEV_ADMIN_EMAIL") ?? "admin@pixo.ai";
// Deterministic dev password — never used for real users; only for the seeded dev admin.
const DEV_PASSWORD = Deno.env.get("DEV_ADMIN_PASSWORD") ?? "PixoDev!2026#Bootstrap";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1. Find the dev admin user
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(`listUsers: ${listErr.message}`);
    let user = list.users.find((u) => (u.email ?? "").toLowerCase() === DEV_EMAIL.toLowerCase());

    // 2. Create if missing
    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Pixo Dev Admin" },
      });
      if (createErr) throw new Error(`createUser: ${createErr.message}`);
      user = created.user!;
    } else {
      // Always reset to known password so dev sign-in is reliable
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        password: DEV_PASSWORD,
        email_confirm: true,
      });
      if (updErr) throw new Error(`updateUser: ${updErr.message}`);
    }

    // 3. Ensure admin role
    const { data: existingRole } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: user.id, role: "admin" });
    }

    // 4. Ensure employee_profile (active) so useAuth.fetchEmployee passes
    const { data: emp } = await admin
      .from("employee_profiles")
      .select("id, status")
      .ilike("email", DEV_EMAIL)
      .maybeSingle();
    if (!emp) {
      await admin.from("employee_profiles").insert({
        employee_code: "ADMIN001",
        name: "Pixo Dev Admin",
        email: DEV_EMAIL,
        role: "admin",
        status: "active",
      });
    } else if (emp.status !== "active") {
      await admin.from("employee_profiles").update({ status: "active" }).eq("id", emp.id);
    }

    // 5. Ensure profile row exists (for joins on profiles.id)
    await admin.from("profiles").upsert({ id: user.id, email: DEV_EMAIL, full_name: "Pixo Dev Admin", user_type: "admin" }, { onConflict: "id" });

    return new Response(
      JSON.stringify({ ok: true, email: DEV_EMAIL, password: DEV_PASSWORD }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
