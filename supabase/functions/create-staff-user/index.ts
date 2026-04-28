import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Mode = "create" | "reset_password" | "update_profile" | "toggle_status" | "delete";

interface Payload {
  mode?: Mode;
  // create
  full_name?: string;
  email?: string;
  phone?: string | null;
  employee_code?: string;
  role?: string;
  joining_date?: string | null;
  status?: string;
  password?: string;
  // reset_password / update_profile / toggle_status
  employee_id?: string;
  // update_profile
  new_name?: string;
  new_phone?: string | null;
  new_role?: string;
  new_status?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword() {
  // 12-char strong-ish temp password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const mode: Mode = body.mode ?? "create";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ---------- CREATE ----------
    if (mode === "create") {
      const required = ["full_name", "email", "employee_code", "password"] as const;
      for (const k of required) {
        if (!body[k] || typeof body[k] !== "string") {
          return json({ error: `Missing field: ${k}` }, 400);
        }
      }
      if ((body.password as string).length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }

      const email = (body.email as string).trim().toLowerCase();
      const role = (body.role ?? "admin").trim();
      const status = (body.status ?? "active").trim();

      const { data: existingEmp } = await supabaseAdmin
        .from("employee_profiles")
        .select("id, email, employee_code")
        .or(`email.eq.${email},employee_code.eq.${body.employee_code}`)
        .maybeSingle();

      if (existingEmp) {
        return json({
          error:
            existingEmp.email === email
              ? "An employee with this email already exists"
              : "An employee with this code already exists",
        }, 409);
      }

      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuth = list?.users?.find((u) => u.email?.toLowerCase() === email);

      let userId: string;
      if (existingAuth) {
        userId = existingAuth.id;
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
        if (createErr || !created.user) return json({ error: createErr?.message ?? "Failed to create auth user" }, 500);
        userId = created.user.id;
      }

      const { error: empErr } = await supabaseAdmin.from("employee_profiles").insert({
        employee_code: (body.employee_code as string).trim(),
        name: (body.full_name as string).trim(),
        email,
        phone: body.phone?.trim() || null,
        role,
        status,
        joining_date: body.joining_date || null,
      });

      if (empErr) return json({ error: `Auth user created but profile insert failed: ${empErr.message}`, user_id: userId }, 500);

      return json({ success: true, user_id: userId, email, employee_code: body.employee_code, role });
    }

    // ---------- RESET PASSWORD ----------
    if (mode === "reset_password") {
      if (!body.employee_id && !body.email) return json({ error: "employee_id or email required" }, 400);

      let targetEmail = body.email?.toLowerCase().trim();
      if (!targetEmail && body.employee_id) {
        const { data: emp } = await supabaseAdmin
          .from("employee_profiles")
          .select("email")
          .eq("id", body.employee_id)
          .maybeSingle();
        if (!emp?.email) return json({ error: "Employee not found or has no email" }, 404);
        targetEmail = emp.email.toLowerCase();
      }

      const newPassword = (body.password && body.password.length >= 8) ? body.password : randomPassword();

      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === targetEmail);

      let userId: string;
      if (existing) {
        userId = existing.id;
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 500);
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: targetEmail!,
          password: newPassword,
          email_confirm: true,
        });
        if (error || !created.user) return json({ error: error?.message ?? "Failed to create auth user" }, 500);
        userId = created.user.id;
      }

      return json({
        success: true,
        mode: "reset_password",
        email: targetEmail,
        user_id: userId,
        temporary_password: newPassword,
      });
    }

    // ---------- UPDATE PROFILE ----------
    if (mode === "update_profile") {
      if (!body.employee_id) return json({ error: "employee_id required" }, 400);
      const updates: Record<string, unknown> = {};
      if (body.new_name !== undefined) updates.name = body.new_name;
      if (body.new_phone !== undefined) updates.phone = body.new_phone;
      if (body.new_role !== undefined) updates.role = body.new_role;
      if (body.new_status !== undefined) updates.status = body.new_status;

      if (Object.keys(updates).length === 0) return json({ error: "No fields to update" }, 400);

      const { data, error } = await supabaseAdmin
        .from("employee_profiles")
        .update(updates)
        .eq("id", body.employee_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, mode: "update_profile", employee: data });
    }

    // ---------- TOGGLE STATUS ----------
    if (mode === "toggle_status") {
      if (!body.employee_id) return json({ error: "employee_id required" }, 400);
      const { data: cur, error: getErr } = await supabaseAdmin
        .from("employee_profiles")
        .select("status")
        .eq("id", body.employee_id)
        .single();
      if (getErr) return json({ error: getErr.message }, 500);
      const next = cur.status === "active" ? "inactive" : "active";
      const { data, error } = await supabaseAdmin
        .from("employee_profiles")
        .update({ status: next })
        .eq("id", body.employee_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, mode: "toggle_status", employee: data });
    }

    // ---------- DELETE ----------
    if (mode === "delete") {
      if (!body.employee_id) return json({ error: "employee_id required" }, 400);

      const { data: emp, error: getErr } = await supabaseAdmin
        .from("employee_profiles")
        .select("id, email")
        .eq("id", body.employee_id)
        .maybeSingle();
      if (getErr) return json({ error: getErr.message }, 500);
      if (!emp) return json({ error: "Employee not found" }, 404);

      // Resolve auth user id by email (if any)
      let userId: string | null = null;
      if (emp.email) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        userId = list?.users?.find((u) => u.email?.toLowerCase() === emp.email!.toLowerCase())?.id ?? null;
      }

      // Delete employee_profiles row
      const { error: delEmpErr } = await supabaseAdmin
        .from("employee_profiles")
        .delete()
        .eq("id", emp.id);
      if (delEmpErr) return json({ error: delEmpErr.message }, 500);

      // Best-effort cleanup of role + profile + auth user
      if (userId) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authDelErr) {
          return json({ success: true, mode: "delete", warning: `Profile removed but auth deletion failed: ${authDelErr.message}` });
        }
      }

      return json({ success: true, mode: "delete", employee_id: emp.id });
    }

    return json({ error: `Unknown mode: ${mode}` }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
