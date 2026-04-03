import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, UserPlus, Shield, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", staff_role: "staff_support", department: "" });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_members").select("*, profiles:user_id(full_name, email, avatar_url)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const inviteStaff = useMutation({
    mutationFn: async () => {
      // Create auth user, then staff record - in production this should be an edge function
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: crypto.randomUUID().slice(0, 16), // Temporary password
        options: { data: { full_name: form.full_name } }
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Add role
      await supabase.from("user_roles").insert({ user_id: authData.user.id, role: form.staff_role as any });
      
      // Add staff member record
      const { error } = await supabase.from("staff_members").insert({
        user_id: authData.user.id,
        staff_role: form.staff_role,
        department: form.department,
        invited_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      toast.success("Staff member invited");
      setInviteOpen(false);
      setForm({ full_name: "", email: "", phone: "", staff_role: "staff_support", department: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="People & Admissions" subtitle="Staff management & system integrity">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Total Staff" value={staff?.length ?? 0} icon={Users} />
          <MetricCard title="Active" value={staff?.filter((s: any) => s.active_status === "active").length ?? 0} icon={Shield} changeType="positive" change="Operational" />
          <MetricCard title="Pending Invites" value={0} icon={UserPlus} />
          <MetricCard title="Risk Flags" value={0} icon={AlertTriangle} changeType="neutral" change="None" />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Staff Directory</CardTitle>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="text-xs gap-1.5"><UserPlus className="h-3.5 w-3.5" />Onboard Staff</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Onboard New Staff</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Full Name</Label>
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
                        <Label className="text-xs">Role</Label>
                        <Select value={form.staff_role} onValueChange={v => setForm(f => ({ ...f, staff_role: v }))}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff_support">Support</SelectItem>
                            <SelectItem value="staff_sales">Sales</SelectItem>
                            <SelectItem value="staff_content">Content</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Department</Label>
                        <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                      </div>
                    </div>
                    <Button onClick={() => inviteStaff.mutate()} disabled={inviteStaff.isPending} className="w-full">
                      {inviteStaff.isPending ? "Creating..." : "Authorize & Onboard"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : !staff || staff.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No staff members yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Department</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-medium">{s.profiles?.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{s.profiles?.email || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{s.staff_role}</Badge></TableCell>
                      <TableCell className="text-xs">{s.department || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border-0 ${s.active_status === "active" ? "bg-pixo-green/10 text-pixo-green" : "bg-muted text-muted-foreground"}`}>
                          {s.active_status}
                        </Badge>
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
