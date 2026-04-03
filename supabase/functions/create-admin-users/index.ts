import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: string[] = [];

  const users = [
    { email: "founder@pixo.ai", password: "PixoFounder2025!", full_name: "Pixo Founder", role: "founder" as const },
    { email: "admin@pixo.ai", password: "PixoAdmin2025!", full_name: "Pixo Admin", role: "admin" as const },
  ];

  for (const u of users) {
    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((eu) => eu.email === u.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      results.push(`User ${u.email} already exists: ${userId}`);
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });

      if (error) {
        results.push(`FAILED creating ${u.email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      results.push(`Created ${u.email}: ${userId}`);
    }

    // Upsert profile
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: u.email, full_name: u.full_name }, { onConflict: "id" });
    if (profileErr) results.push(`Profile error for ${u.email}: ${profileErr.message}`);
    else results.push(`Profile upserted for ${u.email}`);

    // Upsert user_roles
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });
    if (roleErr) results.push(`Role error for ${u.email}: ${roleErr.message}`);
    else results.push(`Role '${u.role}' assigned to ${u.email}`);
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
