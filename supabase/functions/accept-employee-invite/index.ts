// Public endpoint: validates an employee invite token, creates the auth user,
// employee_profiles row, and user_roles entry. Marks the invite as used (one-time).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const OFFICE_ROLES = ["admin", "hr", "developer", "ops", "support", "content", "staff"];
const COMMISSION_ROLES = ["sales", "field_sales", "tele_sales", "partner"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const url = new URL(req.url);

    // GET ?token=...  -> return invite metadata (for the join page to display)
    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "token required" }, 400);
      const { data, error } = await admin
        .from("employee_invites")
        .select("id, category, designation, preset_role, invited_email, status, used_at")
        .eq("token", token)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Invalid invite link" }, 404);
      if (data.status !== "pending") return json({ error: "This invite has already been used or revoked" }, 410);
      return json({ invite: data });
    }

    // POST -> consume invite + create user
    const body = await req.json();
    const { token, full_name, email, phone, password, designation, employee_code } = body ?? {};

    if (!token || !full_name || !email || !password || !employee_code) {
      return json({ error: "token, full_name, email, password, employee_code are required" }, 400);
    }
    if (String(password).length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    // Lock invite row
    const { data: invite, error: inviteErr } = await admin
      .from("employee_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (inviteErr) return json({ error: inviteErr.message }, 500);
    if (!invite) return json({ error: "Invalid invite link" }, 404);
    if (invite.status !== "pending") return json({ error: "This invite has already been used" }, 410);

    const finalDesignation = designation || invite.designation || invite.preset_role || invite.category;
    const finalRole = (invite.preset_role || (invite.category === "commission" ? "sales" : "staff")).toLowerCase();
    const allowed = invite.category === "commission" ? COMMISSION_ROLES : OFFICE_ROLES;
    if (!allowed.includes(finalRole)) {
      return json({ error: `Role "${finalRole}" not valid for category "${invite.category}"` }, 400);
    }

    // Check duplicate email
    const { data: existingEmp } = await admin
      .from("employee_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingEmp) return json({ error: "An employee with this email already exists" }, 409);

    // Create auth user
    const { data: authResult, error: authErr } = await admin.auth.admin.createUser({
      email: String(email).toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr || !authResult.user) return json({ error: authErr?.message ?? "Failed to create user" }, 500);
    const userId = authResult.user.id;

    // Insert/update profile
    await admin.from("profiles").upsert(
      { id: userId, email: String(email).toLowerCase(), full_name, phone: phone || null, user_type: "employee" },
      { onConflict: "id" },
    );

    // Create employee_profile
    const { error: empErr } = await admin.from("employee_profiles").insert({
      employee_code,
      name: full_name,
      email: String(email).toLowerCase(),
      phone: phone || null,
      role: finalRole,
      category: invite.category,
      designation: finalDesignation,
      status: "active",
      joining_date: new Date().toISOString().slice(0, 10),
    });
    if (empErr) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(userId);
      return json({ error: empErr.message }, 500);
    }

    // Map to user_roles enum (only allow valid app_role enum values)
    const enumRole = mapToAppRole(finalRole, invite.category);
    if (enumRole) {
      await admin.from("user_roles").insert({ user_id: userId, role: enumRole });
    }

    // Mark invite used (atomic-ish: re-check status)
    const { data: claimed, error: claimErr } = await admin
      .from("employee_invites")
      .update({ status: "used", used_at: new Date().toISOString(), used_by_user_id: userId })
      .eq("id", invite.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (claimErr || !claimed) {
      // Race lost — rollback
      await admin.auth.admin.deleteUser(userId);
      await admin.from("employee_profiles").delete().eq("email", String(email).toLowerCase());
      return json({ error: "Invite was already used. Please request a new link." }, 410);
    }

    return json({ ok: true, user_id: userId, email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  function json(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapToAppRole(role: string, category: string): string | null {
  if (category === "commission") return "staff_sales";
  switch (role) {
    case "admin": return "admin";
    case "support": return "staff_support";
    case "content": return "staff_content";
    case "hr":
    case "developer":
    case "ops":
    case "staff":
    default:
      return "staff_support"; // default office staff role for RLS
  }
}
