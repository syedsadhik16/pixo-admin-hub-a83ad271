import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, IndianRupee, Trophy, Download, Award } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

interface Employee {
  id: string;
  employee_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  joining_date: string | null;
  status: string;
}

interface SalesTxn {
  id: string;
  employee_id: string;
  user_id: string;
  order_id: string | null;
  plan_name: string | null;
  plan_amount: number;
  commission_amount: number;
  created_at: string;
}

function calcCommission(amount: number) {
  if (amount >= 14999) return 2000;
  if (amount >= 9999) return 1500;
  if (amount >= 5999) return 1000;
  return 0;
}

export default function SalesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("performance");
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [empForm, setEmpForm] = useState({ employee_code: "", name: "", phone: "", email: "", role: "sales", joining_date: "" });
  const [saleForm, setSaleForm] = useState({ employee_id: "", user_id: "", order_id: "", plan_name: "", plan_amount: "" });
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const employeesQ = useQuery({
    queryKey: ["sales-employees"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("employee_profiles").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message || "Failed to load employees");
      return (data ?? []) as Employee[];
    },
    retry: 1,
    staleTime: 30_000,
  });

  const txnsQ = useQuery({
    queryKey: ["sales-txns"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("sales_transactions").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message || "Failed to load sales transactions");
      return (data ?? []) as SalesTxn[];
    },
    retry: 1,
    staleTime: 30_000,
  });

  const addEmployee = useMutation({
    mutationFn: async () => {
      if (!empForm.employee_code || !empForm.name) throw new Error("Employee code and name are required");
      const { error } = await (supabase.from as any)("employee_profiles").insert({
        employee_code: empForm.employee_code,
        name: empForm.name,
        phone: empForm.phone || null,
        email: empForm.email || null,
        role: empForm.role,
        joining_date: empForm.joining_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee added");
      setAddOpen(false);
      setEmpForm({ employee_code: "", name: "", phone: "", email: "", role: "sales", joining_date: "" });
      qc.invalidateQueries({ queryKey: ["sales-employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logSale = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(saleForm.plan_amount);
      if (!saleForm.employee_id || !saleForm.user_id || !amt) throw new Error("Employee, student user ID and amount are required");
      const { error } = await (supabase.from as any)("sales_transactions").insert({
        employee_id: saleForm.employee_id,
        user_id: saleForm.user_id,
        order_id: saleForm.order_id || null,
        plan_name: saleForm.plan_name || null,
        plan_amount: amt,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale logged & commission calculated");
      setLogOpen(false);
      setSaleForm({ employee_id: "", user_id: "", order_id: "", plan_name: "", plan_amount: "" });
      qc.invalidateQueries({ queryKey: ["sales-txns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empMap = useMemo(() => {
    const m = new Map<string, Employee>();
    (employeesQ.data ?? []).forEach(e => m.set(e.id, e));
    return m;
  }, [employeesQ.data]);

  const filteredTxns = useMemo(() => {
    return (txnsQ.data ?? []).filter(t => {
      if (empFilter !== "all" && t.employee_id !== empFilter) return false;
      if (planFilter !== "all" && t.plan_name !== planFilter) return false;
      if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [txnsQ.data, empFilter, planFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const txns = filteredTxns;
    const totalRevenue = txns.reduce((s, t) => s + Number(t.plan_amount), 0);
    const totalCommission = txns.reduce((s, t) => s + Number(t.commission_amount), 0);
    const perEmp = new Map<string, { sales: number; revenue: number; commission: number }>();
    txns.forEach(t => {
      const e = perEmp.get(t.employee_id) ?? { sales: 0, revenue: 0, commission: 0 };
      e.sales += 1;
      e.revenue += Number(t.plan_amount);
      e.commission += Number(t.commission_amount);
      perEmp.set(t.employee_id, e);
    });
    let topId = "";
    let topRev = 0;
    perEmp.forEach((v, k) => { if (v.revenue > topRev) { topRev = v.revenue; topId = k; } });
    return { totalRevenue, totalCommission, perEmp, topName: empMap.get(topId)?.name ?? "—", topRev };
  }, [filteredTxns, empMap]);

  const performanceRows = useMemo(() => {
    return (employeesQ.data ?? []).map(e => {
      const s = stats.perEmp.get(e.id) ?? { sales: 0, revenue: 0, commission: 0 };
      const conversion = s.sales > 0 ? "—" : "0%"; // Conversion needs leads-assigned data; placeholder
      return {
        employee_code: e.employee_code,
        name: e.name,
        role: e.role,
        status: e.status,
        sales: s.sales,
        revenue: s.revenue,
        commission: s.commission,
        conversion,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [employeesQ.data, stats]);

  const planNames = useMemo(() => {
    const set = new Set<string>();
    (txnsQ.data ?? []).forEach(t => t.plan_name && set.add(t.plan_name));
    return Array.from(set);
  }, [txnsQ.data]);

  async function exportPerformance() {
    await exportAndDownload(
      `pixo-employee-performance-${new Date().toISOString().slice(0, 10)}`,
      performanceRows,
      [
        { key: "employee_code", label: "Employee Code" },
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "status", label: "Status" },
        { key: "sales", label: "Total Sales" },
        { key: "revenue", label: "Total Revenue" },
        { key: "commission", label: "Total Commission" },
        { key: "conversion", label: "Conversion %" },
      ],
      "employee_performance",
      { empFilter, planFilter, dateFrom, dateTo },
    );
    toast.success("CSV exported");
  }

  async function exportTxns() {
    await exportAndDownload(
      `pixo-sales-transactions-${new Date().toISOString().slice(0, 10)}`,
      filteredTxns.map(t => ({
        ...t,
        employee_name: empMap.get(t.employee_id)?.name ?? "—",
        employee_code: empMap.get(t.employee_id)?.employee_code ?? "—",
      })),
      [
        { key: "created_at" as never, label: "Date" },
        { key: "employee_code" as never, label: "Employee Code" },
        { key: "employee_name" as never, label: "Employee" },
        { key: "user_id", label: "Student User ID" },
        { key: "order_id", label: "Order ID" },
        { key: "plan_name", label: "Plan" },
        { key: "plan_amount", label: "Amount" },
        { key: "commission_amount", label: "Commission" },
      ],
      "sales_transactions",
      { empFilter, planFilter, dateFrom, dateTo },
    );
    toast.success("CSV exported");
  }

  const queryError = (employeesQ.error as Error | null) || (txnsQ.error as Error | null);
  const initialLoading = (employeesQ.isLoading && !employeesQ.data) || (txnsQ.isLoading && !txnsQ.data);

  return (
    <AdminLayout title="Sales & Commission" subtitle="Employee revenue tracking and commission engine">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString("en-IN")}`} icon={IndianRupee} mono />
          <MetricCard title="Total Commission" value={`₹${stats.totalCommission.toLocaleString("en-IN")}`} icon={Award} mono />
          <MetricCard title="Active Employees" value={(employeesQ.data ?? []).filter(e => e.status === "active").length} icon={Users} />
          <MetricCard title="Top Performer" value={stats.topName} change={stats.topRev ? `₹${stats.topRev.toLocaleString("en-IN")}` : ""} icon={Trophy} changeType="positive" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="performance" className="text-xs">Sales Performance</TabsTrigger>
                  <TabsTrigger value="employees" className="text-xs">Employee List</TabsTrigger>
                  <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Dialog open={logOpen} onOpenChange={setLogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5"><IndianRupee className="h-3.5 w-3.5" />Log Sale</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Log a Sale</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Employee</Label>
                        <Select value={saleForm.employee_id} onValueChange={v => setSaleForm(f => ({ ...f, employee_id: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Select employee" /></SelectTrigger>
                          <SelectContent>
                            {(employeesQ.data ?? []).map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.employee_code} — {e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Student User ID</Label>
                        <Input value={saleForm.user_id} onChange={e => setSaleForm(f => ({ ...f, user_id: e.target.value }))} placeholder="uuid" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Order ID</Label>
                          <Input value={saleForm.order_id} onChange={e => setSaleForm(f => ({ ...f, order_id: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Plan</Label>
                          <Input value={saleForm.plan_name} onChange={e => setSaleForm(f => ({ ...f, plan_name: e.target.value }))} placeholder="e.g. Annual" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Plan Amount (₹)</Label>
                        <Input type="number" value={saleForm.plan_amount} onChange={e => setSaleForm(f => ({ ...f, plan_amount: e.target.value }))} placeholder="5999 / 9999 / 14999" />
                        {saleForm.plan_amount && (
                          <p className="text-[11px] text-muted-foreground">Auto commission: ₹{calcCommission(parseFloat(saleForm.plan_amount) || 0).toLocaleString("en-IN")}</p>
                        )}
                      </div>
                      <Button onClick={() => logSale.mutate()} disabled={logSale.isPending} className="w-full">
                        {logSale.isPending ? "Saving..." : "Save Sale"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="text-xs gap-1.5"><UserPlus className="h-3.5 w-3.5" />Add Employee</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Employee Code *</Label>
                          <Input value={empForm.employee_code} onChange={e => setEmpForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="EMP001" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Name *</Label>
                          <Input value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Phone</Label>
                          <Input value={empForm.phone} onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Email</Label>
                          <Input type="email" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Role</Label>
                          <Select value={empForm.role} onValueChange={v => setEmpForm(f => ({ ...f, role: v }))}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="ops">Ops</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Joining Date</Label>
                          <Input type="date" value={empForm.joining_date} onChange={e => setEmpForm(f => ({ ...f, joining_date: e.target.value }))} />
                        </div>
                      </div>
                      <Button onClick={() => addEmployee.mutate()} disabled={addEmployee.isPending} className="w-full">
                        {addEmployee.isPending ? "Saving..." : "Add Employee"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {(employeesQ.data ?? []).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {planNames.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" placeholder="From" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" placeholder="To" />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={tab === "transactions" ? exportTxns : exportPerformance}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? <LoadingSpinner /> : (
              <>
                <TabsContent value="performance" forceMount={tab === "performance" ? true : undefined} hidden={tab !== "performance"}>
                  {performanceRows.length === 0 ? (
                    <EmptyState icon={Trophy} title="No employees yet" description="Add an employee to track sales performance." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono-label">Employee</TableHead>
                          <TableHead className="font-mono-label">Role</TableHead>
                          <TableHead className="font-mono-label text-right">Total Sales</TableHead>
                          <TableHead className="font-mono-label text-right">Revenue</TableHead>
                          <TableHead className="font-mono-label text-right">Commission</TableHead>
                          <TableHead className="font-mono-label text-right">Conversion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {performanceRows.map(r => (
                          <TableRow key={r.employee_code}>
                            <TableCell className="text-xs">
                              <div className="font-medium">{r.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{r.employee_code}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.role}</Badge></TableCell>
                            <TableCell className="text-xs text-right font-mono">{r.sales}</TableCell>
                            <TableCell className="text-xs text-right font-mono">₹{r.revenue.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right font-mono">₹{r.commission.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right">{r.conversion}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="employees" forceMount={tab === "employees" ? true : undefined} hidden={tab !== "employees"}>
                  {(employeesQ.data ?? []).length === 0 ? (
                    <EmptyState icon={Users} title="No employees" description="Click 'Add Employee' to create the first record." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono-label">Code</TableHead>
                          <TableHead className="font-mono-label">Name</TableHead>
                          <TableHead className="font-mono-label">Role</TableHead>
                          <TableHead className="font-mono-label">Phone</TableHead>
                          <TableHead className="font-mono-label">Email</TableHead>
                          <TableHead className="font-mono-label">Joined</TableHead>
                          <TableHead className="font-mono-label">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(employeesQ.data ?? []).map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs font-mono">{e.employee_code}</TableCell>
                            <TableCell className="text-xs font-medium">{e.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px] capitalize">{e.role}</Badge></TableCell>
                            <TableCell className="text-xs">{e.phone ?? "—"}</TableCell>
                            <TableCell className="text-xs">{e.email ?? "—"}</TableCell>
                            <TableCell className="text-xs">{e.joining_date ?? "—"}</TableCell>
                            <TableCell><Badge variant={e.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{e.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="transactions" forceMount={tab === "transactions" ? true : undefined} hidden={tab !== "transactions"}>
                  {filteredTxns.length === 0 ? (
                    <EmptyState icon={IndianRupee} title="No transactions" description="Log a sale to populate this table." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono-label">Date</TableHead>
                          <TableHead className="font-mono-label">Employee</TableHead>
                          <TableHead className="font-mono-label">Student</TableHead>
                          <TableHead className="font-mono-label">Plan</TableHead>
                          <TableHead className="font-mono-label">Order</TableHead>
                          <TableHead className="font-mono-label text-right">Amount</TableHead>
                          <TableHead className="font-mono-label text-right">Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTxns.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs font-medium">
                              {empMap.get(t.employee_id)?.name ?? "—"}
                              <div className="text-[10px] text-muted-foreground font-mono">{empMap.get(t.employee_id)?.employee_code}</div>
                            </TableCell>
                            <TableCell className="text-[10px] font-mono truncate max-w-[140px]">{t.user_id}</TableCell>
                            <TableCell className="text-xs">{t.plan_name ?? "—"}</TableCell>
                            <TableCell className="text-[10px] font-mono">{t.order_id ?? "—"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">₹{Number(t.plan_amount).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-xs text-right font-mono text-pixo-green">₹{Number(t.commission_amount).toLocaleString("en-IN")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
