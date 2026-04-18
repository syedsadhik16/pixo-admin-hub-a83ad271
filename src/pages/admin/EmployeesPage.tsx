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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, UserPlus, Shield, AlertTriangle, KeyRound, Pencil, Power, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EmployeeRow {
  id: string;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  joining_date: string | null;
  created_at: string;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [resetTarget, setResetTarget] = useState<EmployeeRow | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

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

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    role: "sales",
    status: "active",
  });

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employee-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as EmployeeRow[];
    },
  });

  const createStaffUser = useMutation({
    mutationFn: async () => {
      const { full_name, email, employee_code, password } = createForm;
      if (!full_name || !email || !employee_code || !password) {
        throw new Error("Full name, email, employee code, and password are required");
      }
      if (password.length < 8) throw new Error("Password must be at least 8 characters");

      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: { mode: "create", ...createForm },
      });
      if (error) throw new Error(error.message ?? "Failed to create user");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["employee-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["sales-employees"] });
      toast.success(`Staff user created: ${data?.email ?? createForm.email}`);
      setCreateUserOpen(false);
      setCreateForm({ full_name: "", email: "", phone: "", employee_code: "", role: "admin", joining_date: "", status: "active", password: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async (emp: EmployeeRow) => {
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: { mode: "reset_password", employee_id: emp.id, email: emp.email },
      });
      if (error) throw new Error(error.message ?? "Reset failed");
      if (data?.error) throw new Error(data.error);
      return data as { email: string; temporary_password: string };
    },
    onSuccess: (data) => {
      setResetResult({ email: data.email, password: data.temporary_password });
      setResetTarget(null);
      toast.success("Temporary password generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editTarget) throw new Error("No employee selected");
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: {
          mode: "update_profile",
          employee_id: editTarget.id,
          new_name: editForm.name,
          new_phone: editForm.phone || null,
          new_role: editForm.role,
          new_status: editForm.status,
        },
      });
      if (error) throw new Error(error.message ?? "Update failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["sales-employees"] });
      toast.success("Employee updated");
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (emp: EmployeeRow) => {
      const { data, error } = await supabase.functions.invoke("create-staff-user", {
        body: { mode: "toggle_status", employee_id: emp.id },
      });
      if (error) throw new Error(error.message ?? "Toggle failed");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["employee-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["sales-employees"] });
      toast.success(`Status: ${data?.employee?.status ?? "updated"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = employees?.length ?? 0;
  const active = employees?.filter(e => e.status === "active").length ?? 0;

  function openEdit(emp: EmployeeRow) {
    setEditForm({
      name: emp.name ?? "",
      phone: emp.phone ?? "",
      role: emp.role ?? "sales",
      status: emp.status ?? "active",
    });
    setEditTarget(emp);
  }

  return (
    <AdminLayout title="People & Admissions" subtitle="Staff registry & operational controls">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-end flex-wrap gap-2">
          <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs gap-1.5"><UserPlus className="h-3.5 w-3.5" />Create Staff User</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Staff User (Auth + Profile)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Full Name *</Label>
                    <Input value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Employee Code *</Label>
                    <Input value={createForm.employee_code} onChange={e => setCreateForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="e.g. EMP005" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email *</Label>
                  <Input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone</Label>
                    <Input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Joining Date</Label>
                    <Input type="date" value={createForm.joining_date} onChange={e => setCreateForm(f => ({ ...f, joining_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Role</Label>
                    <Select value={createForm.role} onValueChange={v => setCreateForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="ops">Ops</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temporary Password * (min 8 chars)</Label>
                  <Input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="Will be set as login password" />
                </div>
                <Button onClick={() => createStaffUser.mutate()} disabled={createStaffUser.isPending} className="w-full">
                  {createStaffUser.isPending ? "Creating..." : "Create Auth User + Profile"}
                </Button>
                <p className="text-[11px] text-muted-foreground">Creates a Supabase Auth user and matching employee_profiles row in one step.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Staff" value={total} icon={Users} />
          <MetricCard title="Active" value={active} icon={Shield} changeType="positive" change="Operational" />
          <MetricCard title="Inactive" value={total - active} icon={Power} />
          <MetricCard title="Risk Flags" value={0} icon={AlertTriangle} changeType="neutral" change="None" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Employee Registry (employee_profiles)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSpinner />
            ) : !employees || employees.length === 0 ? (
              <EmptyState icon={Users} title="No employees yet" description="Click 'Create Staff User' to add your first team member" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Code</TableHead>
                    <TableHead className="font-mono-label">Name</TableHead>
                    <TableHead className="font-mono-label">Email</TableHead>
                    <TableHead className="font-mono-label">Phone</TableHead>
                    <TableHead className="font-mono-label">Role</TableHead>
                    <TableHead className="font-mono-label">Status</TableHead>
                    <TableHead className="font-mono-label text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id} className="animate-fade-in">
                      <TableCell className="text-[11px] font-mono">{e.employee_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {e.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") || "?"}
                          </div>
                          <span className="text-xs font-medium">{e.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{e.email || "—"}</TableCell>
                      <TableCell className="text-xs">{e.phone || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{e.role}</Badge></TableCell>
                      <TableCell><StatusBadge status={e.status === "active" ? "active" : "inactive"} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => setResetTarget(e)}
                            disabled={!e.email}
                            title={e.email ? "Reset password" : "No email on file"}
                          >
                            <KeyRound className="h-3 w-3" />Reset
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => openEdit(e)}
                          >
                            <Pencil className="h-3 w-3" />Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => toggleStatus.mutate(e)}
                            disabled={toggleStatus.isPending}
                          >
                            <Power className="h-3 w-3" />
                            {e.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
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

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="ops">Ops</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="w-full">
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset password confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password for {resetTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A new temporary password will be generated for <span className="font-mono">{resetTarget?.email}</span>.
              Hand it over securely. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetTarget && resetPassword.mutate(resetTarget)} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password result */}
      <Dialog open={!!resetResult} onOpenChange={(o) => !o && setResetResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Temporary password generated</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Share this with the employee securely. It will not be shown again.</div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input readOnly value={resetResult?.email ?? ""} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temporary Password</Label>
              <div className="flex gap-2">
                <Input readOnly value={resetResult?.password ?? ""} className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (resetResult?.password) {
                      navigator.clipboard.writeText(resetResult.password);
                      toast.success("Copied");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button onClick={() => setResetResult(null)} className="w-full">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
