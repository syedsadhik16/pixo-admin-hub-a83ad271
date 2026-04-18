import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateStaffPayload {
  full_name: string;
  email: string;
  phone?: string;
  employee_code: string;
  role?: string;
  joining_date?: string;
  status?: string;
  password: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as CreateStaffPayload;

    const required = ["full_name", "email", "employee_code", "password"] as const;
    for (const k of required) {
      if (!body[k] || typeof body[k] !== "string") {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (body.password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const email = body.email.trim().toLowerCase();
    const role = (body.role ?? "admin").trim();
    const status = (body.status ?? "active").trim();

    // Duplicate email in employee_profiles?
    const { data: existingEmp } = await supabaseAdmin
      .from("employee_profiles")
      .select("id, email, employee_code")
      .or(`email.eq.${email},employee_code.eq.${body.employee_code}`)
      .maybeSingle();

    if (existingEmp) {
      return new Response(
        JSON.stringify({
          error:
            existingEmp.email === email
              ? "An employee with this email already exists"
              : "An employee with this code already exists",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if Auth user exists
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuth = list?.users?.find((u) => u.email?.toLowerCase() === email);

    let userId: string;
    if (existingAuth) {
      userId = existingAuth.id;
      // Reset password to the supplied one so admin can hand it over
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: body.password,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.full_name },
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "Failed to create auth user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Insert employee_profiles row
    const { error: empErr } = await supabaseAdmin.from("employee_profiles").insert({
      employee_code: body.employee_code.trim(),
      name: body.full_name.trim(),
      email,
      phone: body.phone?.trim() || null,
      role,
      status,
      joining_date: body.joining_date || null,
    });

    if (empErr) {
      return new Response(JSON.stringify({ error: `Auth user created but profile insert failed: ${empErr.message}`, user_id: userId }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email,
        employee_code: body.employee_code,
        role,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
