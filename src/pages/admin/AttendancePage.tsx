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
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Search, CalendarCheck, Loader2, Users, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { exportAndDownload } from "@/lib/admin/csv";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkReason, setBulkReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

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
    const m = new Map<string, NonNullable<typeof records>[number]>();
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

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selected.has(s.user_id));
  const someFilteredSelected = filtered.some(s => selected.has(s.user_id));

  function toggleOne(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }
  function toggleAllFiltered(checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(s => { if (checked) next.add(s.user_id); else next.delete(s.user_id); });
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  async function suppressAbsenceAlerts(studentIds: string[]) {
    if (studentIds.length === 0) return;
    const startIso = `${date}T00:00:00Z`;
    const endIso = `${date}T23:59:59Z`;
    await supabase
      .from("parent_notifications")
      .update({ read: true })
      .in("student_user_id", studentIds)
      .eq("notification_type", "absence_alert")
      .gte("created_at", startIso)
      .lte("created_at", endIso);
  }

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

    if (status === "present" || status === "late" || status === "excused") {
      await suppressAbsenceAlerts([studentId]);
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

  async function bulkSetStatus(status: AttendanceStatus) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkRunning(true);

    const reason = (status === "excused" || status === "absent") ? (bulkReason.trim() || null) : null;
    const existingIds = ids.filter(id => recordByStudent.has(id));
    const newIds = ids.filter(id => !recordByStudent.has(id));

    let failures = 0;

    // Updates (must be per-row to target each existing record id)
    for (const id of existingIds) {
      const existing = recordByStudent.get(id)!;
      const { error } = await supabase
        .from("attendance_records")
        .update({
          status,
          reason: reason ?? (status === "excused" || status === "absent" ? existing.reason ?? null : null),
        })
        .eq("id", existing.id);
      if (error) failures++;
    }

    // Inserts in one batch
    if (newIds.length > 0) {
      const rows = newIds.map(id => ({
        student_user_id: id,
        attendance_date: date,
        status,
        reason,
        session_title: null,
      }));
      const { error } = await supabase.from("attendance_records").insert(rows);
      if (error) failures += newIds.length;
    }

    if (status === "present" || status === "late" || status === "excused") {
      await suppressAbsenceAlerts(ids);
    }

    if (user?.id) {
      const logs = ids.map(id => ({
        actor_user_id: user.id,
        action_type: "attendance_override",
        module_key: "attendance",
        target_id: id,
        meta: { date, status, reason, source: "admin_attendance_page", bulk: true, batch_size: ids.length },
      }));
      await supabase.from("audit_logs").insert(logs);
    }

    setBulkRunning(false);
    qc.invalidateQueries({ queryKey: ["attendance-records", date] });

    if (failures === 0) {
      toast.success(`Marked ${ids.length} student${ids.length === 1 ? "" : "s"} as ${STATUS_LABELS[status]}`);
      clearSelection();
      setBulkReason("");
    } else if (failures < ids.length) {
      toast.warning(`Updated ${ids.length - failures} of ${ids.length}. ${failures} failed.`);
    } else {
      toast.error(`Bulk update failed for all ${ids.length} students.`);
    }
  }

  const isLoading = studentsLoading || recordsLoading;
  const selectedCount = selected.size;

  async function handleExportCsv() {
    if (filtered.length === 0) {
      toast.error("No students to export");
      return;
    }
    const rows = filtered.map(s => {
      const rec = recordByStudent.get(s.user_id);
      const status = (rec?.status as AttendanceStatus | undefined) ?? null;
      return {
        name: s.name,
        email: s.email,
        level: s.level,
        grade: s.grade,
        scheduled: scheduledSet.has(s.user_id) ? "Yes" : "No",
        status: status ? STATUS_LABELS[status] : "Not marked",
        reason: rec?.reason ?? "",
        session_title: rec?.session_title ?? "",
        attendance_date: date,
      };
    });
    await exportAndDownload(
      `attendance-${date}.csv`,
      rows,
      [
        { key: "name", label: "Student" },
        { key: "email", label: "Email" },
        { key: "level", label: "Level" },
        { key: "grade", label: "Grade" },
        { key: "scheduled", label: "Scheduled" },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        { key: "session_title", label: "Session" },
        { key: "attendance_date", label: "Date" },
      ],
      "attendance_roster",
      { date, search: search || null, row_count: rows.length },
    );
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }

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
          <CardContent className="space-y-3">
            {selectedCount > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{selectedCount} selected</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Bulk reason (excused/absent)"
                    value={bulkReason}
                    onChange={e => setBulkReason(e.target.value)}
                    className="h-7 text-xs w-56"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    disabled={bulkRunning}
                    onClick={() => bulkSetStatus("present")}
                  >
                    Mark Present
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={bulkRunning}
                    onClick={() => bulkSetStatus("late")}
                  >
                    Mark Late
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={bulkRunning}
                    onClick={() => bulkSetStatus("excused")}
                  >
                    Mark Excused
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    disabled={bulkRunning}
                    onClick={() => bulkSetStatus("absent")}
                  >
                    Mark Absent
                  </Button>
                  {bulkRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            )}

            {isLoading ? (
              <LoadingSpinner />
            ) : filtered.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No students" description="No students match the current filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                        onCheckedChange={(v) => toggleAllFiltered(Boolean(v))}
                        aria-label="Select all visible"
                      />
                    </TableHead>
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
                    const isSelected = selected.has(s.user_id);
                    return (
                      <TableRow key={s.user_id} data-state={isSelected ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => toggleOne(s.user_id, Boolean(v))}
                            aria-label={`Select ${s.name}`}
                          />
                        </TableCell>
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
