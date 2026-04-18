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
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Search, Target, Download, Edit2 } from "lucide-react";
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
  stage: Stage;
  remarks: string;
  next_follow_up: string | null;
  pricing_visited: boolean;
  payment_visited: boolean;
  subscription_status: string;
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
  const [editStage, setEditStage] = useState<Stage>("cold");
  const [editRemarks, setEditRemarks] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-crm-leads"],
    queryFn: async (): Promise<LeadRow[]> => {
      const [profilesRes, pipelineRes, studentsRes, parentsRes, entRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, created_at, signup_source, user_type"),
        (supabase.from as any)("lead_pipeline").select("*"),
        supabase.from("student_profiles").select("user_id"),
        supabase.from("parent_profiles").select("user_id"),
        supabase.from("user_entitlements").select("user_id, is_active, plan_name"),
      ]);

      const pipeMap = new Map<string, any>(((pipelineRes as any).data ?? []).map((p: any) => [p.user_id, p]));
      const studentSet = new Set((studentsRes.data ?? []).map(s => s.user_id));
      const parentSet = new Set((parentsRes.data ?? []).map(p => p.user_id));
      const entMap = new Map((entRes.data ?? []).map(e => [e.user_id, e]));

      return (profilesRes.data ?? []).map(p => {
        const pipe = pipeMap.get(p.id);
        const ent = entMap.get(p.id);
        const userType = p.user_type ?? (studentSet.has(p.id) ? "student" : parentSet.has(p.id) ? "parent" : "unknown");
        const subStatus = ent?.is_active ? (ent.plan_name ?? "active") : "none";
        return {
          user_id: p.id,
          name: p.full_name ?? "—",
          email: p.email ?? "—",
          phone: p.phone ?? "—",
          user_type: userType,
          signup_date: p.created_at,
          signup_source: p.signup_source,
          stage: (pipe?.stage ?? (ent?.is_active ? "converted" : "cold")) as Stage,
          remarks: pipe?.remarks ?? "",
          next_follow_up: pipe?.next_follow_up_at ?? null,
          pricing_visited: !!pipe?.pricing_page_visited,
          payment_visited: !!pipe?.payment_page_visited,
          subscription_status: subStatus,
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
        { key: "signup_date", label: "Signup Date" },
        { key: "signup_source", label: "Source" },
        { key: "stage", label: "Lead Stage" },
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
                    <TableHead className="font-mono-label">Stage</TableHead>
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
                        <div className="text-muted-foreground text-[10px]">{r.signup_date ? new Date(r.signup_date).toLocaleDateString() : "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{r.email}</div>
                        <div className="text-muted-foreground text-[10px]">{r.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{r.user_type}</TableCell>
                      <TableCell><Badge variant={stageVariant(r.stage)} className="capitalize">{r.stage}</Badge></TableCell>
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
    </AdminLayout>
  );
}
