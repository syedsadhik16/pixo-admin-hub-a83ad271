import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Search, Target, Download, Edit2, Sparkles } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

// Stage vocabulary matches the lead_events_autobump trigger and the lead_pipeline check constraint.
type Stage = "cold" | "warm" | "hot" | "converted" | "dropped";
const STAGES: Stage[] = ["cold", "warm", "hot", "converted", "dropped"];

interface LeadRow {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  signup_date: string | null;
  signup_source: string | null;
  location: string | null;
  grade: string | null;
  board: string | null;
  age: number | null;
  stage: Stage;
  remarks: string;
  next_follow_up: string | null;
  pricing_visited: boolean;
  payment_visited: boolean;
  subscription_status: string;
  assessment_score: number | null;
  assessment_date: string | null;
  assessment_summary: string | null;
  fluency_score: number | null;
  phonics_score: number | null;
  pronunciation_score: number | null;
  vocabulary_score: number | null;
  confidence_score: number | null;
}

function stageVariant(s: Stage) {
  if (s === "converted") return "default" as const;
  if (s === "hot") return "destructive" as const;
  if (s === "warm") return "secondary" as const;
  return "outline" as const;
}

export default function CRMPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [assessing, setAssessing] = useState<LeadRow | null>(null);
  const [editStage, setEditStage] = useState<Stage>("cold");
  const [editRemarks, setEditRemarks] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-crm-leads"],
    queryFn: async (): Promise<LeadRow[]> => {
      const [profilesRes, pipelineRes, studentsRes, parentsRes, entRes, perfRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, created_at, signup_source, user_type, location"),
        (supabase.from as any)("lead_pipeline").select("*"),
        supabase.from("student_profiles").select("user_id, age, grade, school_board"),
        supabase.from("parent_profiles").select("user_id"),
        supabase.from("user_entitlements").select("user_id, is_active, plan_name"),
        supabase.from("performance_snapshots")
          .select("student_user_id, snapshot_date, fluency_score, phonics_score, pronunciation_score, vocabulary_score, confidence_score, summary")
          .order("snapshot_date", { ascending: false })
          .limit(2000),
      ]);

      const pipeMap = new Map<string, any>(((pipelineRes as any).data ?? []).map((p: any) => [p.user_id, p]));
      const studentMap = new Map((studentsRes.data ?? []).map(s => [s.user_id, s]));
      const parentSet = new Set((parentsRes.data ?? []).map(p => p.user_id));
      const entMap = new Map((entRes.data ?? []).map(e => [e.user_id, e]));

      // Take the latest snapshot per student
      const perfMap = new Map<string, any>();
      (perfRes.data ?? []).forEach((row: any) => {
        if (!perfMap.has(row.student_user_id)) perfMap.set(row.student_user_id, row);
      });

      const avg = (...vals: (number | null | undefined)[]) => {
        const nums = vals.filter((v): v is number => typeof v === "number");
        if (nums.length === 0) return null;
        return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
      };

      return (profilesRes.data ?? []).map(p => {
        const pipe = pipeMap.get(p.id);
        const ent = entMap.get(p.id);
        const stu: any = studentMap.get(p.id);
        const userType = p.user_type ?? (stu ? "student" : parentSet.has(p.id) ? "parent" : "unknown");
        const subStatus = ent?.is_active ? (ent.plan_name ?? "active") : "none";
        const perf = perfMap.get(p.id);
        const score = perf
          ? avg(perf.fluency_score, perf.phonics_score, perf.pronunciation_score, perf.vocabulary_score, perf.confidence_score)
          : null;
        return {
          user_id: p.id,
          name: p.full_name ?? "—",
          email: p.email ?? "—",
          phone: p.phone ?? "—",
          user_type: userType,
          signup_date: p.created_at,
          signup_source: p.signup_source,
          location: p.location ?? null,
          grade: stu?.grade ?? null,
          board: stu?.school_board ?? null,
          age: stu?.age ?? null,
          stage: (pipe?.stage ?? (ent?.is_active ? "converted" : "cold")) as Stage,
          remarks: pipe?.remarks ?? "",
          next_follow_up: pipe?.next_follow_up_at ?? null,
          pricing_visited: !!pipe?.pricing_page_visited,
          payment_visited: !!pipe?.payment_page_visited,
          subscription_status: subStatus,
          assessment_score: score,
          assessment_date: perf?.snapshot_date ?? null,
          assessment_summary: perf?.summary ?? null,
          fluency_score: perf?.fluency_score ?? null,
          phonics_score: perf?.phonics_score ?? null,
          pronunciation_score: perf?.pronunciation_score ?? null,
          vocabulary_score: perf?.vocabulary_score ?? null,
          confidence_score: perf?.confidence_score ?? null,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter(r => {
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      if (search) {
        const t = search.toLowerCase();
        if (!r.name.toLowerCase().includes(t) && !r.email.toLowerCase().includes(t) && !r.phone.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [data, stageFilter, search]);

  const counts = useMemo(() => {
    const c = { cold: 0, warm: 0, hot: 0, converted: 0, dropped: 0 } as Record<Stage, number>;
    (data ?? []).forEach(r => { c[r.stage] = (c[r.stage] ?? 0) + 1; });
    return c;
  }, [data]);

  function openEdit(row: LeadRow) {
    setEditing(row);
    setEditStage(row.stage);
    setEditRemarks(row.remarks);
    setEditFollowUp(row.next_follow_up ? row.next_follow_up.slice(0, 16) : "");
  }

  async function saveEdit() {
    if (!editing) return;
    const payload = {
      user_id: editing.user_id,
      stage: editStage,
      remarks: editRemarks,
      next_follow_up_at: editFollowUp ? new Date(editFollowUp).toISOString() : null,
      last_activity_at: new Date().toISOString(),
    };
    const { error } = await (supabase.from as any)("lead_pipeline").upsert(payload, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Lead updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-crm-leads"] });
    }
  }

  async function exportCsv() {
    await exportAndDownload(
      `pixo-crm-${new Date().toISOString().slice(0, 10)}`,
      filtered,
      [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "user_type", label: "User Type" },
        { key: "grade", label: "Grade" },
        { key: "board", label: "Board" },
        { key: "age", label: "Age" },
        { key: "location", label: "Location" },
        { key: "signup_date", label: "Signup Date" },
        { key: "signup_source", label: "Source" },
        { key: "stage", label: "Lead Stage" },
        { key: "assessment_score", label: "Assessment Score" },
        { key: "assessment_date", label: "Assessment Date" },
        { key: "assessment_summary", label: "Assessment Summary" },
        { key: "remarks", label: "Remarks" },
        { key: "next_follow_up", label: "Next Follow-Up" },
        { key: "pricing_visited", label: "Pricing Visited" },
        { key: "payment_visited", label: "Payment Visited" },
        { key: "subscription_status", label: "Subscription" },
      ],
      "crm_leads",
      { stage: stageFilter, search },
    );
    toast.success("CSV exported");
  }

  return (
    <AdminLayout title="CRM / Leads Pipeline" subtitle="Every signup, every stage. Edit inline.">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {STAGES.map(s => (
            <Card key={s} className="cursor-pointer" onClick={() => setStageFilter(s)}>
              <CardContent className="p-4">
                <p className="font-mono-label text-muted-foreground capitalize">{s}</p>
                <p className="text-2xl font-bold mt-1">{counts[s] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" /> Leads ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs w-56" />
                </div>
                <Select value={stageFilter} onValueChange={v => setStageFilter(v as any)}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCsv}>
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
              <EmptyState icon={Target} title="No leads" description="No leads match the current filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Lead</TableHead>
                    <TableHead className="font-mono-label">Contact</TableHead>
                    <TableHead className="font-mono-label">Type</TableHead>
                    <TableHead className="font-mono-label">Grade / Board</TableHead>
                    <TableHead className="font-mono-label">Source</TableHead>
                    <TableHead className="font-mono-label">Stage</TableHead>
                    <TableHead className="font-mono-label">Assessment</TableHead>
                    <TableHead className="font-mono-label">Funnel</TableHead>
                    <TableHead className="font-mono-label">Follow-Up</TableHead>
                    <TableHead className="font-mono-label">Remarks</TableHead>
                    <TableHead className="font-mono-label"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.user_id}>
                      <TableCell className="text-xs font-medium">
                        <div>{r.name}</div>
                        <div className="text-muted-foreground text-[10px]">
                          {r.signup_date ? new Date(r.signup_date).toLocaleDateString() : "—"}
                          {r.location ? ` · ${r.location}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{r.email}</div>
                        <div className="text-muted-foreground text-[10px]">{r.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{r.user_type}</TableCell>
                      <TableCell className="text-xs">
                        {r.grade || r.board ? (
                          <>
                            <div>{r.grade ?? "—"}</div>
                            <div className="text-muted-foreground text-[10px]">
                              {r.board ?? "—"}{r.age ? ` · age ${r.age}` : ""}
                            </div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{r.signup_source || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><Badge variant={stageVariant(r.stage)} className="capitalize">{r.stage}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {r.assessment_score !== null ? (
                          <button
                            type="button"
                            onClick={() => setAssessing(r)}
                            className="text-left hover:text-primary transition-colors"
                          >
                            <div className="font-semibold flex items-center gap-1">
                              {r.assessment_score}/100
                              <Sparkles className="h-3 w-3 opacity-60" />
                            </div>
                            <div className="text-muted-foreground text-[10px] max-w-[160px] truncate">
                              {r.assessment_date ? new Date(r.assessment_date).toLocaleDateString() : ""}
                            </div>
                          </button>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex gap-1">
                          {r.pricing_visited && <Badge variant="outline" className="text-[9px] px-1">Pricing</Badge>}
                          {r.payment_visited && <Badge variant="outline" className="text-[9px] px-1">Payment</Badge>}
                          {!r.pricing_visited && !r.payment_visited && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.next_follow_up ? new Date(r.next_follow_up).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.remarks || "—"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Lead — {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="font-mono-label text-muted-foreground">Stage</label>
              <Select value={editStage} onValueChange={v => setEditStage(v as Stage)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono-label text-muted-foreground">Next follow-up</label>
              <Input type="datetime-local" value={editFollowUp} onChange={e => setEditFollowUp(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="font-mono-label text-muted-foreground">Remarks</label>
              <Textarea value={editRemarks} onChange={e => setEditRemarks(e.target.value)} rows={4} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!assessing} onOpenChange={o => !o && setAssessing(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Assessment — {assessing?.name}
            </SheetTitle>
            <SheetDescription>
              Latest snapshot:{" "}
              {assessing?.assessment_date
                ? new Date(assessing.assessment_date).toLocaleDateString(undefined, { dateStyle: "medium" })
                : "No assessment yet"}
            </SheetDescription>
          </SheetHeader>

          {assessing && (
            <div className="mt-6 space-y-5">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-mono-label text-muted-foreground">Overall Score</p>
                <p className="text-3xl font-bold mt-1">
                  {assessing.assessment_score ?? "—"}<span className="text-lg text-muted-foreground">/100</span>
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Fluency", value: assessing.fluency_score },
                  { label: "Phonics", value: assessing.phonics_score },
                  { label: "Pronunciation", value: assessing.pronunciation_score },
                  { label: "Vocabulary", value: assessing.vocabulary_score },
                  { label: "Confidence", value: assessing.confidence_score },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium">{s.label}</span>
                      <span className="font-mono text-muted-foreground">
                        {s.value !== null && s.value !== undefined ? `${Math.round(s.value)}/100` : "—"}
                      </span>
                    </div>
                    <Progress value={s.value ?? 0} className="h-2" />
                  </div>
                ))}
              </div>

              {assessing.assessment_summary && (
                <div className="rounded-lg border p-4">
                  <p className="font-mono-label text-muted-foreground mb-2">AI Summary</p>
                  <p className="text-sm leading-relaxed">{assessing.assessment_summary}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
