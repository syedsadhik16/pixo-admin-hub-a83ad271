import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Search, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

type AttendanceStatus = "present" | "late" | "excused" | "absent";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  excused: "Excused",
  absent: "Absent",
};

const STATUS_VARIANTS: Record<AttendanceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  present: "default",
  late: "secondary",
  excused: "outline",
  absent: "destructive",
};

export default function AttendancePage() {
  const { user } = useAuthContext();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["attendance-students"],
    queryFn: async () => {
      const [sp, p] = await Promise.all([
        supabase.from("student_profiles").select("user_id, current_level, grade"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const pMap = new Map((p.data ?? []).map(x => [x.id, x]));
      return (sp.data ?? []).map(s => ({
        user_id: s.user_id,
        name: pMap.get(s.user_id)?.full_name ?? "—",
        email: pMap.get(s.user_id)?.email ?? "—",
        level: s.current_level ?? "—",
        grade: s.grade ?? "—",
      }));
    },
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ["attendance-records", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, student_user_id, status, reason, session_title, attendance_date")
        .eq("attendance_date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: scheduled } = useQuery({
    queryKey: ["attendance-scheduled", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("child_schedule")
        .select("student_user_id, class_status")
        .eq("scheduled_date", date);
      return data ?? [];
    },
  });

  const recordByStudent = useMemo(() => {
    const m = new Map<string, typeof records[number]>();
    (records ?? []).forEach(r => m.set(r.student_user_id, r));
    return m;
  }, [records]);

  const scheduledSet = useMemo(
    () => new Set((scheduled ?? []).filter(s => s.class_status !== "cancelled").map(s => s.student_user_id)),
    [scheduled],
  );

  const filtered = useMemo(() => {
    return (students ?? []).filter(s => {
      if (!search) return true;
      const t = search.toLowerCase();
      return s.name.toLowerCase().includes(t) || s.email.toLowerCase().includes(t);
    });
  }, [students, search]);

  async function setStatus(studentId: string, status: AttendanceStatus) {
    setSavingId(studentId);
    const existing = recordByStudent.get(studentId);
    const reason = reasonDraft[studentId] ?? existing?.reason ?? null;
    const payload = {
      student_user_id: studentId,
      attendance_date: date,
      status,
      reason: status === "excused" || status === "absent" ? reason : null,
      session_title: existing?.session_title ?? null,
    };

    let err: any = null;
    if (existing) {
      const { error } = await supabase
        .from("attendance_records")
        .update(payload)
        .eq("id", existing.id);
      err = error;
    } else {
      const { error } = await supabase.from("attendance_records").insert(payload);
      err = error;
    }

    if (err) {
      toast.error(`Failed: ${err.message}`);
      setSavingId(null);
      return;
    }

    // Suppress duplicate absence notifications: if any "absence_alert" already
    // exists for this student today, mark it read so the parent isn't pinged.
    if (status === "present" || status === "late" || status === "excused") {
      const startIso = `${date}T00:00:00Z`;
      const endIso = `${date}T23:59:59Z`;
      await supabase
        .from("parent_notifications")
        .update({ read: true })
        .eq("student_user_id", studentId)
        .eq("notification_type", "absence_alert")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
    }

    if (user?.id) {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        action_type: "attendance_override",
        module_key: "attendance",
        target_id: studentId,
        meta: { date, status, reason, source: "admin_attendance_page" },
      });
    }

    toast.success(`Marked ${STATUS_LABELS[status]}`);
    setSavingId(null);
    qc.invalidateQueries({ queryKey: ["attendance-records", date] });
  }

  const isLoading = studentsLoading || recordsLoading;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Attendance Override</h1>
          <p className="text-sm text-muted-foreground">
            Mark students as Present, Late, or Excused after the fact. Excused or attended status prevents absence notifications to parents for that day.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarCheck className="h-4 w-4" />
                Roster — {date}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-8 text-xs w-40"
                />
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs w-56"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : filtered.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No students" description="No students match the current filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Student</TableHead>
                    <TableHead className="font-mono-label">Level</TableHead>
                    <TableHead className="font-mono-label">Scheduled</TableHead>
                    <TableHead className="font-mono-label">Current</TableHead>
                    <TableHead className="font-mono-label">Reason / Note</TableHead>
                    <TableHead className="font-mono-label text-right">Mark As</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => {
                    const rec = recordByStudent.get(s.user_id);
                    const current = (rec?.status as AttendanceStatus | undefined) ?? null;
                    const isScheduled = scheduledSet.has(s.user_id);
                    return (
                      <TableRow key={s.user_id}>
                        <TableCell>
                          <div className="text-xs font-medium">{s.name}</div>
                          <div className="text-[10px] text-muted-foreground">{s.email}</div>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{s.level}</TableCell>
                        <TableCell>
                          {isScheduled ? (
                            <Badge variant="secondary" className="text-[10px]">Yes</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {current ? (
                            <Badge variant={STATUS_VARIANTS[current]} className="text-[10px] capitalize">
                              {STATUS_LABELS[current]}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Not marked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Reason (excused/absent)"
                            defaultValue={rec?.reason ?? ""}
                            onChange={e => setReasonDraft(d => ({ ...d, [s.user_id]: e.target.value }))}
                            className="h-7 text-xs w-44"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Select
                              value={current ?? ""}
                              onValueChange={(v) => setStatus(s.user_id, v as AttendanceStatus)}
                              disabled={savingId === s.user_id}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue placeholder="Set status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="late">Late</SelectItem>
                                <SelectItem value="excused">Excused</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                              </SelectContent>
                            </Select>
                            {savingId === s.user_id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
