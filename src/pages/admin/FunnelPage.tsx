import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Filter, Download, Search } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

type Stage = "initiated" | "success" | "failed";

interface FunnelRow {
  id: string;
  user_id: string;
  studentName: string;
  parentName: string;
  phone: string;
  email: string;
  plan: string;
  amount: number;
  stage: Stage;
  status: string;
  created_at: string;
  completed_at: string | null;
  failure_reason: string | null;
  subscription_active: boolean;
}

function stageColor(s: Stage) {
  if (s === "success") return "bg-pixo-green/15 text-pixo-green border-pixo-green/30";
  if (s === "failed") return "bg-pixo-red/15 text-pixo-red border-pixo-red/30";
  return "bg-pixo-blue/15 text-pixo-blue border-pixo-blue/30";
}

export default function FunnelPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-funnel"],
    queryFn: async (): Promise<FunnelRow[]> => {
      const [ordersRes, txRes, profRes, linksRes, entRes] = await Promise.all([
        supabase.from("payment_orders").select("*"),
        supabase.from("payment_transactions").select("*"),
        supabase.from("profiles").select("id, full_name, email, phone"),
        supabase.from("parent_children").select("parent_user_id, student_user_id, status"),
        supabase.from("user_entitlements").select("user_id, is_active"),
      ]);

      const profMap = new Map((profRes.data ?? []).map(p => [p.id, p]));
      const txByOrder = new Map<string, any>();
      (txRes.data ?? []).forEach(t => { if (t.order_id) txByOrder.set(t.order_id, t); });
      const parentByStudent = new Map<string, string>();
      (linksRes.data ?? []).forEach(l => { if (l.status === "active") parentByStudent.set(l.student_user_id, l.parent_user_id); });
      const entActive = new Set((entRes.data ?? []).filter(e => e.is_active).map(e => e.user_id));

      return (ordersRes.data ?? []).map(o => {
        const tx = o.order_id ? txByOrder.get(o.order_id) : null;
        const status = (tx?.status ?? o.status ?? "created").toLowerCase();
        let stage: Stage = "initiated";
        if (status === "captured" || status === "success" || status === "paid") stage = "success";
        else if (status === "failed") stage = "failed";

        const studentProf = profMap.get(o.user_id);
        const parentId = parentByStudent.get(o.user_id);
        const parentProf = parentId ? profMap.get(parentId) : null;

        return {
          id: o.id,
          user_id: o.user_id,
          studentName: studentProf?.full_name ?? o.user_id.slice(0, 8),
          parentName: parentProf?.full_name ?? "—",
          phone: studentProf?.phone ?? parentProf?.phone ?? "—",
          email: studentProf?.email ?? "—",
          plan: o.plan_name ?? "—",
          amount: Number(o.amount ?? 0),
          stage,
          status,
          created_at: o.created_at ?? "",
          completed_at: tx?.created_at ?? null,
          failure_reason: tx?.failure_reason ?? null,
          subscription_active: entActive.has(o.user_id),
        };
      });
    },
  });

  const filtered = useMemo(() => (data ?? []).filter(r => {
    if (stageFilter !== "all" && r.stage !== stageFilter) return false;
    if (search) {
      const t = search.toLowerCase();
      if (!r.studentName.toLowerCase().includes(t) && !r.email.toLowerCase().includes(t) && !r.phone.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [data, stageFilter, search]);

  const counts = useMemo(() => {
    const c = { initiated: 0, success: 0, failed: 0 };
    (data ?? []).forEach(r => { c[r.stage]++; });
    return c;
  }, [data]);

  async function exportCsv() {
    await exportAndDownload(
      `pixo-funnel-${new Date().toISOString().slice(0, 10)}`,
      filtered,
      [
        { key: "studentName", label: "Student" },
        { key: "parentName", label: "Parent" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "plan", label: "Plan" },
        { key: "amount", label: "Amount" },
        { key: "stage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created" },
        { key: "completed_at", label: "Completed" },
        { key: "failure_reason", label: "Failure Reason" },
        { key: "subscription_active", label: "Sub Active" },
      ],
      "payment_funnel",
      { stage: stageFilter },
    );
    toast.success("Funnel CSV exported");
  }

  return (
    <AdminLayout title="Payment Funnel" subtitle="3-stage flow: initiated → success / failed">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-pixo-blue/30 bg-pixo-blue/5">
            <CardContent className="p-4">
              <p className="font-mono-label text-pixo-blue">Initiated</p>
              <p className="text-3xl font-bold mt-1">{counts.initiated}</p>
              <p className="text-xs text-muted-foreground mt-1">Pricing → Payment page</p>
            </CardContent>
          </Card>
          <Card className="border-pixo-green/30 bg-pixo-green/5">
            <CardContent className="p-4">
              <p className="font-mono-label text-pixo-green">Successful</p>
              <p className="text-3xl font-bold mt-1">{counts.success}</p>
              <p className="text-xs text-muted-foreground mt-1">Payment captured & sub active</p>
            </CardContent>
          </Card>
          <Card className="border-pixo-red/30 bg-pixo-red/5">
            <CardContent className="p-4">
              <p className="font-mono-label text-pixo-red">Failed</p>
              <p className="text-3xl font-bold mt-1">{counts.failed}</p>
              <p className="text-xs text-muted-foreground mt-1">Recoverable revenue</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Funnel Records ({filtered.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Student / email / phone..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs w-56" />
                </div>
                <Select value={stageFilter} onValueChange={v => setStageFilter(v as any)}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="initiated">Initiated</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
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
              <EmptyState icon={Filter} title="No funnel records" description="No payment orders match the current filter." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Student</TableHead>
                    <TableHead className="font-mono-label">Parent</TableHead>
                    <TableHead className="font-mono-label">Contact</TableHead>
                    <TableHead className="font-mono-label">Plan / Amount</TableHead>
                    <TableHead className="font-mono-label">Stage</TableHead>
                    <TableHead className="font-mono-label">Created</TableHead>
                    <TableHead className="font-mono-label">Completed</TableHead>
                    <TableHead className="font-mono-label">Failure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">{r.studentName}</TableCell>
                      <TableCell className="text-xs">{r.parentName}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.email}</div>
                        <div className="text-muted-foreground text-[10px]">{r.phone}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{r.plan}</div>
                        <div className="text-muted-foreground text-[10px]">₹{r.amount.toLocaleString()}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${stageColor(r.stage)}`}>{r.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs">{r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-xs text-pixo-red">{r.failure_reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
