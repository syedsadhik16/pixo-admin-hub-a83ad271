import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Download, FileSpreadsheet, History, Sheet as SheetIcon, ExternalLink } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

export default function ExportsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);

  const { data: history, refetch } = useQuery({
    queryKey: ["admin-exports-audit"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("exports_audit")
        .select("*, profiles!exports_audit_actor_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return ((data as any[]) ?? []);
    },
  });

  async function runExport(type: string, fn: () => Promise<{ rows: any[]; columns: any[] }>) {
    setBusy(type);
    try {
      const { rows, columns } = await fn();
      await exportAndDownload(`pixo-${type}-${new Date().toISOString().slice(0, 10)}`, rows, columns, type);
      toast.success(`${type} exported (${rows.length} rows)`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function pushToSheets(type: string, fn: () => Promise<{ rows: any[]; columns: any[] }>) {
    setPushing(type);
    try {
      const { rows, columns } = await fn();
      const { data, error } = await supabase.functions.invoke("export-to-sheets", {
        body: { exportType: type, columns, rows },
      });
      if (error) throw error;
      if (data?.status === "not_configured") {
        toast.error("Google Sheets not configured. Add the secrets and try again.");
        return;
      }
      if (!data?.ok) throw new Error(data?.error ?? "Push failed");
      toast.success(`Pushed ${data.rowCount} rows to "${data.sheetTitle}"`, {
        action: data.url ? { label: "Open", onClick: () => window.open(data.url, "_blank") } : undefined,
      });
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Push to Sheets failed");
    } finally {
      setPushing(null);
    }
  }

  const exports = [
    {
      key: "all_users",
      title: "All Users",
      description: "Every signup with profile + role",
      run: async () => {
        const [pRes, rRes] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
        const roles = new Map<string, string[]>();
        (rRes.data ?? []).forEach(r => {
          const arr = roles.get(r.user_id) ?? []; arr.push(r.role); roles.set(r.user_id, arr);
        });
        const rows = (pRes.data ?? []).map(p => ({ ...p, roles: (roles.get(p.id) ?? []).join(",") }));
        return {
          rows, columns: [
            { key: "id", label: "User ID" }, { key: "full_name", label: "Name" },
            { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
            { key: "user_type", label: "Type" }, { key: "roles", label: "Roles" },
            { key: "location", label: "Location" }, { key: "address", label: "Address" },
            { key: "signup_source", label: "Source" }, { key: "created_at", label: "Created" },
            { key: "last_login_at", label: "Last Login" }, { key: "is_active", label: "Active" },
          ],
        };
      },
    },
    {
      key: "students",
      title: "Students",
      description: "Student profiles + progress",
      run: async () => {
        const [sRes, pRes, prRes] = await Promise.all([
          supabase.from("student_profiles").select("*"),
          supabase.from("profiles").select("id, full_name, email, phone, location"),
          supabase.from("student_progress").select("*"),
        ]);
        const pm = new Map((pRes.data ?? []).map(p => [p.id, p]));
        const prm = new Map((prRes.data ?? []).map(p => [p.student_user_id, p]));
        const rows = (sRes.data ?? []).map(s => {
          const prof = pm.get(s.user_id); const prog = prm.get(s.user_id);
          return {
            user_id: s.user_id, name: prof?.full_name, email: prof?.email, phone: prof?.phone,
            location: prof?.location, grade: s.grade, age: s.age, level: s.current_level,
            plan: s.active_plan, current_day: prog?.current_day ?? 0,
            completed_days: prog?.completed_days ?? 0, streak: prog?.streak_count ?? 0,
            confidence: prog?.confidence_score ?? 0, accuracy: prog?.accuracy_score ?? 0,
          };
        });
        return { rows, columns: Object.keys(rows[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
    {
      key: "parents",
      title: "Parents",
      description: "Parent profiles + linked children",
      run: async () => {
        const [paRes, prRes, lkRes] = await Promise.all([
          supabase.from("parent_profiles").select("*"),
          supabase.from("profiles").select("id, full_name, email, phone, location"),
          supabase.from("parent_children").select("parent_user_id, student_user_id, status"),
        ]);
        const pm = new Map((prRes.data ?? []).map(p => [p.id, p]));
        const childByParent = new Map<string, string[]>();
        (lkRes.data ?? []).filter(l => l.status === "active").forEach(l => {
          const arr = childByParent.get(l.parent_user_id) ?? [];
          const c = pm.get(l.student_user_id); arr.push(c?.full_name ?? l.student_user_id.slice(0, 8));
          childByParent.set(l.parent_user_id, arr);
        });
        const rows = (paRes.data ?? []).map(p => {
          const prof = pm.get(p.user_id);
          const kids = childByParent.get(p.user_id) ?? [];
          return {
            user_id: p.user_id, name: prof?.full_name, email: prof?.email, phone: prof?.phone,
            location: prof?.location, relationship: p.relationship_label,
            children_count: kids.length, children: kids.join(", "),
          };
        });
        return { rows, columns: Object.keys(rows[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
    {
      key: "leads",
      title: "Leads / CRM",
      description: "Every signup with lead stage",
      run: async () => {
        const [pRes, lpRes] = await Promise.all([
          supabase.from("profiles").select("id, full_name, email, phone, created_at, signup_source, user_type"),
          (supabase.from as any)("lead_pipeline").select("*"),
        ]);
        const lp = new Map<string, any>(((lpRes as any).data ?? []).map((l: any) => [l.user_id, l]));
        const rows = (pRes.data ?? []).map(p => {
          const l = lp.get(p.id);
          return {
            user_id: p.id, name: p.full_name, email: p.email, phone: p.phone,
            user_type: p.user_type, signup_date: p.created_at, source: p.signup_source,
            stage: l?.stage ?? "cold", remarks: l?.remarks ?? "",
            next_follow_up: l?.next_follow_up_at, owner: l?.owner_user_id,
          };
        });
        return { rows, columns: Object.keys(rows[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
    {
      key: "payments",
      title: "Payments",
      description: "All transactions + orders",
      run: async () => {
        const { data } = await supabase.from("payment_transactions").select("*");
        return { rows: data ?? [], columns: Object.keys((data ?? [])[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
    {
      key: "subscriptions",
      title: "Subscriptions",
      description: "Active + expired entitlements",
      run: async () => {
        const [eRes, pRes] = await Promise.all([
          supabase.from("user_entitlements").select("*"),
          supabase.from("profiles").select("id, full_name, email, phone"),
        ]);
        const pm = new Map((pRes.data ?? []).map(p => [p.id, p]));
        const rows = (eRes.data ?? []).map(e => {
          const p = pm.get(e.user_id);
          return {
            user_id: e.user_id, name: p?.full_name, email: p?.email, phone: p?.phone,
            plan: e.plan_name, duration: e.plan_duration_months, payment_status: e.payment_status,
            is_active: e.is_active, valid_from: e.valid_from, valid_until: e.valid_until,
          };
        });
        return { rows, columns: Object.keys(rows[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
    {
      key: "progress",
      title: "Progress",
      description: "Engagement + scores per student",
      run: async () => {
        const [prRes, pRes] = await Promise.all([
          supabase.from("student_progress").select("*"),
          supabase.from("profiles").select("id, full_name"),
        ]);
        const pm = new Map((pRes.data ?? []).map(p => [p.id, p]));
        const rows = (prRes.data ?? []).map(p => ({ name: pm.get(p.student_user_id)?.full_name, ...p }));
        return { rows, columns: Object.keys(rows[0] ?? {}).map(k => ({ key: k, label: k })) };
      },
    },
  ];

  return (
    <AdminLayout title="Exports" subtitle="One-click CSV. Google Sheets sync ready.">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exports.map(x => (
            <Card key={x.key}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <FileSpreadsheet className="h-5 w-5 text-pixo-blue" />
                  <Badge variant="outline" className="text-[9px]">CSV · Sheets</Badge>
                </div>
                <p className="text-sm font-medium">{x.title}</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">{x.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" disabled={busy === x.key} onClick={() => runExport(x.key, x.run)}>
                    <Download className="h-3 w-3" />
                    {busy === x.key ? "..." : "CSV"}
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1" disabled={pushing === x.key} onClick={() => pushToSheets(x.key, x.run)}>
                    <SheetIcon className="h-3 w-3" />
                    {pushing === x.key ? "..." : "Sheets"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-pixo-amber/20 bg-pixo-amber/[0.02]">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-pixo-amber">Google Sheets Live Sync</p>
            <p className="text-xs text-muted-foreground mt-1">
              Backend ready. Edge function <code className="font-mono text-[10px] bg-muted px-1 rounded">export-to-sheets</code> is scaffolded but not deployed.
              To enable: add a <code className="font-mono text-[10px] bg-muted px-1 rounded">GOOGLE_SHEETS_SERVICE_ACCOUNT</code> secret and deploy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Export History</CardTitle>
          </CardHeader>
          <CardContent>
            {!history ? <LoadingSpinner /> : history.length === 0 ? (
              <EmptyState icon={History} title="No exports yet" description="Run an export above to start the audit log." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">When</TableHead>
                    <TableHead className="font-mono-label">Type</TableHead>
                    <TableHead className="font-mono-label">Rows</TableHead>
                    <TableHead className="font-mono-label">Destination</TableHead>
                    <TableHead className="font-mono-label">Filters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-medium">{h.export_type}</TableCell>
                      <TableCell className="text-xs">{h.row_count}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] uppercase">{h.destination}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-[300px] truncate">{JSON.stringify(h.filters)}</TableCell>
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
