import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Shield, AlertTriangle, Code, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { user, isFounder } = useAuthContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"founder" | "admin">(isFounder() ? "founder" : "admin");
  const [jsonView, setJsonView] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", staff_role: "staff_support", department: "" });
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    employee_code: "",
    role: "admin",
    joining_date: "",
    status: "active",
    password: "",
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_members").select("*, profiles:user_id(full_name, email, avatar_url)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const inviteStaff = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.email) throw new Error("Name and email are required");

      const tempId = crypto.randomUUID();
      // Create profile first
      const { error: profileError } = await supabase.from("profiles").insert({
        id: tempId,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
      });
      if (profileError) throw profileError;

      // Add staff member record
      const { error } = await supabase.from("staff_members").insert({
        user_id: tempId,
        staff_role: form.staff_role,
        department: form.department,
        invited_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      toast.success("Staff member onboarded");
      setInviteOpen(false);
      setForm({ full_name: "", email: "", phone: "", staff_role: "staff_support", department: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const founderMode = viewMode === "founder" && isFounder();

  return (
    <AdminLayout title="People & Admissions" subtitle="System integrity registry & staff management">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {isFounder() && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "founder" | "admin")}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="founder" className="text-xs gap-1"><Shield className="h-3 w-3" />FOUNDER</TabsTrigger>
                <TabsTrigger value="admin" className="text-xs gap-1"><Users className="h-3 w-3" />ADMIN</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="flex items-center gap-2">
            {founderMode && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setJsonView(!jsonView)}>
                <Code className="h-3 w-3" />{jsonView ? "Table View" : "JSON View"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1"><FileText className="h-3 w-3" />Bulk Audit</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Staff" value={staff?.length ?? 0} icon={Users} />
          <MetricCard title="Active" value={staff?.filter((s: any) => s.active_status === "active").length ?? 0} icon={Shield} changeType="positive" change="Operational" />
          <MetricCard title="Pending Invites" value={0} icon={UserPlus} />
          <MetricCard title="Risk Flags" value={0} icon={AlertTriangle} changeType="neutral" change="None" />
        </div>

        {founderMode && (
          <div className="pixo-dark-card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-pixo-amber" />
              <h3 className="text-sm font-semibold text-sidebar-foreground">Fraud Watchlist</h3>
              <Badge className="bg-pixo-amber/20 text-pixo-amber border-0 text-[10px]">MONITORING</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {staff?.filter(() => false).map((s: any) => (
                <div key={s.id} className="rounded-lg bg-sidebar-accent/50 p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-pixo-red/20 flex items-center justify-center text-sm font-bold text-pixo-red">
                    {s.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-sidebar-foreground">{s.profiles?.full_name}</p>
                    <StatusBadge status="critical" />
                  </div>
                </div>
              ))}
              <div className="rounded-lg bg-sidebar-accent/30 p-3 text-center">
                <p className="text-xs text-sidebar-foreground/50">No suspicious activity detected</p>
              </div>
            </div>
          </div>
        )}

        {!founderMode && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">🔒 Operational mode — fraud watchlist, commission data, and integrity vectors hidden.</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{founderMode ? "System Integrity Registry" : "People & Admissions"}</CardTitle>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-xs gap-1.5"><UserPlus className="h-3.5 w-3.5" />Onboard Staff</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Onboard New Staff</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Legal Full Name</Label>
                      <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone</Label>
                      <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Role Type</Label>
                        <Select value={form.staff_role} onValueChange={v => setForm(f => ({ ...f, staff_role: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff_sales">Sales</SelectItem>
                            <SelectItem value="staff_support">Counselor</SelectItem>
                            <SelectItem value="staff_content">Support</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Department</Label>
                        <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                      </div>
                    </div>
                    <Button onClick={() => inviteStaff.mutate()} disabled={inviteStaff.isPending || !form.full_name || !form.email} className="w-full">
                      {inviteStaff.isPending ? "Creating..." : "Authorize Enrollment"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : !staff || staff.length === 0 ? (
              <EmptyState icon={Users} title="No staff members yet" description="Click 'Onboard Staff' to add team members" />
            ) : jsonView && founderMode ? (
              <pre className="text-xs font-mono bg-sidebar p-4 rounded-lg text-sidebar-foreground overflow-auto max-h-96">
                {JSON.stringify(staff, null, 2)}
              </pre>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Personnel</TableHead>
                    <TableHead className="font-mono-label">Email</TableHead>
                    <TableHead className="font-mono-label">Role</TableHead>
                    <TableHead className="font-mono-label">Department</TableHead>
                    <TableHead className="font-mono-label">Status</TableHead>
                    {founderMode && <TableHead className="font-mono-label">Integrity</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s: any) => (
                    <TableRow key={s.id} className="animate-fade-in">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {s.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                          </div>
                          <span className="text-xs font-medium">{s.profiles?.full_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{s.profiles?.email || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{s.staff_role?.replace("staff_", "")}</Badge></TableCell>
                      <TableCell className="text-xs">{s.department || "—"}</TableCell>
                      <TableCell><StatusBadge status={s.active_status === "active" ? "active" : "inactive"} /></TableCell>
                      {founderMode && <TableCell><StatusBadge status="on_track" /></TableCell>}
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
