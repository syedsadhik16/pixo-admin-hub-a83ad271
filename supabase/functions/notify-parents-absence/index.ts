import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require CRON_SECRET so only cron / admin can invoke
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

  // Allow caller to override the date (defaults to "today" in UTC)
  const body = await req.json().catch(() => ({} as any));
  const targetDate: string =
    body?.date ??
    new URL(req.url).searchParams.get("date") ??
    new Date().toISOString().slice(0, 10);

  try {
    // 1. Find absent students for the target date.
    //    Includes both: explicit "absent" attendance rows AND
    //    students who had a scheduled class but no attendance row at all.
    const [{ data: scheduled }, { data: attendance }] = await Promise.all([
      supabase
        .from("child_schedule")
        .select("student_user_id, class_status")
        .eq("scheduled_date", targetDate),
      supabase
        .from("attendance_records")
        .select("student_user_id, status, session_title")
        .eq("attendance_date", targetDate),
    ]);

    const attendedSet = new Set(
      (attendance ?? [])
        .filter((a) => a.status === "present" || a.status === "late" || a.status === "excused")
        .map((a) => a.student_user_id),
    );

    // Absent = explicitly marked absent (and NOT also marked attended/excused) OR scheduled-but-not-attended
    const absentSet = new Set<string>();
    (attendance ?? [])
      .filter((a) => a.status === "absent" && !attendedSet.has(a.student_user_id))
      .forEach((a) => absentSet.add(a.student_user_id));
    (scheduled ?? [])
      .filter((s) => s.class_status !== "cancelled" && !attendedSet.has(s.student_user_id))
      .forEach((s) => absentSet.add(s.student_user_id));

    if (absentSet.size === 0) {
      return new Response(
        JSON.stringify({ ok: true, date: targetDate, absent: 0, notifications: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const absentIds = Array.from(absentSet);

    // 2. Find linked parents
    const { data: links, error: linksErr } = await supabase
      .from("parent_children")
      .select("parent_user_id, student_user_id")
      .in("student_user_id", absentIds)
      .eq("status", "active");
    if (linksErr) throw linksErr;
    if (!links || links.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, date: targetDate, absent: absentIds.length, notifications: 0, reason: "no linked parents" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Lookup student names
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", absentIds);
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "your child"]));

    // 4. Skip duplicates: don't insert if a notification with the same
    //    parent + student + date already exists (uses created_at::date match).
    const startIso = `${targetDate}T00:00:00Z`;
    const endIso = `${targetDate}T23:59:59Z`;
    const { data: existing } = await supabase
      .from("parent_notifications")
      .select("parent_user_id, student_user_id")
      .eq("notification_type", "absence_alert")
      .gte("created_at", startIso)
      .lte("created_at", endIso);
    const existingKey = new Set(
      (existing ?? []).map((e) => `${e.parent_user_id}::${e.student_user_id}`),
    );

    const rows = links
      .filter((l) => !existingKey.has(`${l.parent_user_id}::${l.student_user_id}`))
      .map((l) => {
        const studentName = nameMap.get(l.student_user_id) ?? "your child";
        return {
          parent_user_id: l.parent_user_id,
          student_user_id: l.student_user_id,
          notification_type: "absence_alert",
          category: "attendance",
          title: `${studentName} missed class today`,
          body: `${studentName} did not attend the scheduled class on ${targetDate}. Please follow up or contact support if this was unexpected.`,
          read: false,
        };
      });

    let inserted = 0;
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("parent_notifications").insert(rows);
      if (insErr) throw insErr;
      inserted = rows.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: targetDate,
        absent: absentIds.length,
        notifications: inserted,
        skipped_duplicates: links.length - rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
