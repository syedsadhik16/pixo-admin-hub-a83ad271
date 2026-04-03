import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, Search, Download, Eye } from "lucide-react";
import { useState } from "react";

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_transactions")
        .select("*, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("amount, status");
      const captured = data?.filter((t: any) => t.status === "captured").reduce((s, t) => s + (Number(t.amount) || 0), 0) ?? 0;
      const failed = data?.filter((t: any) => t.status === "failed").length ?? 0;
      const total = data?.length ?? 0;
      const successRate = total > 0 ? ((total - failed) / total * 100).toFixed(1) : "100";
      return { captured, failed, total, successRate };
    },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      captured: "bg-pixo-green/10 text-pixo-green",
      pending: "bg-pixo-amber/10 text-pixo-amber",
      failed: "bg-pixo-red/10 text-pixo-red",
      refunded: "bg-pixo-blue/10 text-pixo-blue",
    };
    return map[status] ?? "bg-muted text-muted-foreground";
  };

  const filtered = (transactions ?? []).filter((t: any) => {
    if (!searchTerm) return true;
    const name = t.profiles?.full_name?.toLowerCase() ?? "";
    const pid = t.payment_id?.toLowerCase() ?? "";
    return name.includes(searchTerm.toLowerCase()) || pid.includes(searchTerm.toLowerCase());
  });

  return (
    <AdminLayout title="Payments Intelligence" subtitle="Revenue tracking & audit">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Payment Success Rate" value={`${revenue?.successRate ?? 100}%`} icon={CheckCircle} changeType="positive" change="Healthy" />
          <MetricCard title="Monthly Revenue" value={`₹${(revenue?.captured ?? 0).toLocaleString()}`} icon={TrendingUp} change="+16%" changeType="positive" />
          <MetricCard title="Failed Transactions" value={revenue?.failed ?? 0} icon={AlertTriangle} changeType={revenue?.failed ? "negative" : "neutral"} change={revenue?.failed ? "Needs attention" : "None"} />
          <MetricCard title="Total Transactions" value={revenue?.total ?? 0} icon={CreditCard} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Recent Transactions</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs w-48" />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Payment ID</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs font-mono">{tx.payment_id || tx.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{tx.profiles?.full_name || "—"}</TableCell>
                      <TableCell className="text-xs font-medium">₹{Number(tx.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{tx.payment_method || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border-0 ${statusBadge(tx.status)}`}>{tx.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
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
    </AdminLayout>
  );
}
