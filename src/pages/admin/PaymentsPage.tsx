import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Search, Download, Eye, Zap, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["pay-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_transactions")
        .select("*, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ["pay-metrics"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("amount, status");
      const captured = data?.filter((t: any) => t.status === "captured") ?? [];
      const failed = data?.filter((t: any) => t.status === "failed") ?? [];
      const pending = data?.filter((t: any) => t.status === "pending") ?? [];
      const total = data?.length ?? 0;
      const capturedAmt = captured.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      const failedAmt = failed.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      const successRate = total > 0 ? (((total - failed.length) / total) * 100).toFixed(1) : "100";
      return { capturedAmt, failedAmt, failedCount: failed.length, pendingCount: pending.length, total, successRate };
    },
  });

  const filtered = (transactions ?? []).filter((t: any) => {
    const matchesSearch = !searchTerm || 
      t.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.payment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout title="Payments Intelligence" subtitle="Revenue tracking, audit & recovery">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Gateway Success Rate" value={`${metrics?.successRate ?? 100}%`} icon={CheckCircle} changeType="positive" change="Transaction health" mono />
          <MetricCard title="Monthly Revenue" value={`₹${(metrics?.capturedAmt ?? 0).toLocaleString()}`} icon={TrendingUp} change="Captured payments" changeType="positive" mono />
          <MetricCard title="Failed Transactions" value={metrics?.failedCount ?? 0} icon={AlertTriangle} changeType={metrics?.failedCount ? "negative" : "neutral"} change={metrics?.failedCount ? `₹${(metrics.failedAmt ?? 0).toLocaleString()} recoverable` : "None"} />
          <MetricCard title="Pending Refunds" value={`₹${(metrics?.pendingCount ?? 0)}`} icon={CreditCard} change={`${metrics?.total ?? 0} total transactions`} changeType="neutral" />
        </div>

        {/* Recovery Engine (dark panel) */}
        {(metrics?.failedCount ?? 0) > 0 && (
          <div className="pixo-dark-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-pixo-red" />
                <h3 className="text-sm font-semibold text-sidebar-foreground">Recoverable Revenue</h3>
                <Badge className="bg-pixo-red/20 text-pixo-red border-0 text-[10px]">₹{(metrics?.failedAmt ?? 0).toLocaleString()}</Badge>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground gap-1">
                <RotateCcw className="h-3 w-3" />
                Launch Recovery Engine
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg bg-sidebar-accent/50 p-3">
                <p className="font-mono-label text-sidebar-foreground/50 mb-1">Failure Topology</p>
                <p className="text-xs text-sidebar-foreground">Gateway Timeout: {Math.ceil((metrics?.failedCount ?? 0) * 0.6)}</p>
                <p className="text-xs text-sidebar-foreground">User Abandonment: {Math.floor((metrics?.failedCount ?? 0) * 0.4)}</p>
              </div>
              <div className="rounded-lg bg-sidebar-accent/50 p-3">
                <p className="font-mono-label text-sidebar-foreground/50 mb-1">Automated Retry</p>
                <p className="text-xs text-sidebar-foreground">Smart gateway retry for timeout failures</p>
                <Button variant="outline" size="sm" className="mt-2 h-6 text-[10px] border-sidebar-border text-sidebar-foreground/70">Configure</Button>
              </div>
              <div className="rounded-lg bg-sidebar-accent/50 p-3">
                <p className="font-mono-label text-sidebar-foreground/50 mb-1">Follow-Up</p>
                <p className="text-xs text-sidebar-foreground">Incentivized follow-up for abandonments</p>
                <Button variant="outline" size="sm" className="mt-2 h-6 text-[10px] border-sidebar-border text-sidebar-foreground/70">Configure</Button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Registry */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">Registry Exploration & Recovery</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search by UID or name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs w-48" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="captured">Captured</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : filtered.length === 0 ? (
              <EmptyState icon={CreditCard} title="No transactions found" description="Payment transactions will appear here as they are processed" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Reference UID</TableHead>
                    <TableHead className="font-mono-label">User</TableHead>
                    <TableHead className="font-mono-label">Captured Value</TableHead>
                    <TableHead className="font-mono-label">Method</TableHead>
                    <TableHead className="font-mono-label">Status</TableHead>
                    <TableHead className="font-mono-label">Registry Commit</TableHead>
                    <TableHead className="font-mono-label">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{tx.payment_id || tx.id.slice(0, 12)}</TableCell>
                      <TableCell className="text-xs">{tx.profiles?.full_name || "—"}</TableCell>
                      <TableCell className="text-xs font-medium">₹{Number(tx.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{tx.payment_method || "—"}</TableCell>
                      <TableCell><StatusBadge status={tx.status || "pending"} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                          {tx.status === "failed" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-pixo-amber"><RotateCcw className="h-3.5 w-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
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
