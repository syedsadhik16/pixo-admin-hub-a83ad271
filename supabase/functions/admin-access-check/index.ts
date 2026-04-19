// Public diagnostics endpoint: reports whether an email has an auth user,
// employee profile, and admin role. Uses service role; safe limited output.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!normalized) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check auth user
    let hasAuthUser = false;
    let authUserId: string | null = null;
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = usersPage?.users?.find((u) => u.email?.toLowerCase() === normalized);
    if (match) {
      hasAuthUser = true;
      authUserId = match.id;
    }

    // Check employee_profiles
    const { data: emp } = await admin
      .from("employee_profiles")
      .select("role, status, employee_code, name")
      .ilike("email", normalized)
      .maybeSingle();

    // Check user_roles
    let hasAdminRole = false;
    if (authUserId) {
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", authUserId)
        .eq("role", "admin")
        .maybeSingle();
      hasAdminRole = !!roleRow;
    }

    return new Response(
      JSON.stringify({
        email: normalized,
        hasAuthUser,
        hasEmployeeProfile: !!emp,
        employeeRole: emp?.role ?? null,
        employeeStatus: emp?.status ?? null,
        hasAdminRole,
        canAccessAdmin: hasAuthUser && !!emp && emp.role === "admin" && emp.status === "active",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
