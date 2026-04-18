import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find user by email
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let created = false;

    if (existing) {
      userId = existing.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (updErr) throw updErr;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user.id;
      created = true;
    }

    // Ensure employee_profiles record exists as active admin
    const { data: emp } = await supabaseAdmin
      .from("employee_profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (!emp) {
      await supabaseAdmin.from("employee_profiles").insert({
        employee_code: `ADMIN-${Date.now()}`,
        name: email.split("@")[0],
        email: email.toLowerCase(),
        role: "admin",
        status: "active",
      });
    } else {
      await supabaseAdmin
        .from("employee_profiles")
        .update({ role: "admin", status: "active" })
        .eq("id", emp.id);
    }

    return new Response(
      JSON.stringify({ success: true, userId, created, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
