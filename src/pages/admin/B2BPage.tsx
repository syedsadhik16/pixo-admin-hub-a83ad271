import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Building2, Plus, Pencil, Trash2, Users, Download } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

interface Org {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  seats: number;
  plan: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  full_name: string;
  email: string | null;
  grade: string | null;
  current_level: string | null;
}

const EMPTY_FORM: Omit<Org, "id" | "created_at"> = {
  name: "", contact_name: "", contact_email: "", contact_phone: "",
  seats: 0, plan: "standard", status: "active", notes: "",
};

export default function B2BPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("orgs");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Org | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["b2b-orgs"],
    queryFn: async (): Promise<Org[]> => {
      const { data, error } = await (supabase.from("b2b_organizations" as any) as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Org[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["b2b-members", selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async (): Promise<Member[]> => {
      const { data: students } = await (supabase.from("student_profiles") as any)
        .select("user_id, grade, current_level")
        .eq("b2b_org_id", selectedOrgId!);
      const ids = (students ?? []).map((s: any) => s.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (students ?? []).map((s: any) => {
        const p = profMap.get(s.user_id) as any;
        return {
          user_id: s.user_id,
          full_name: p?.full_name ?? s.user_id.slice(0, 8),
          email: p?.email ?? null,
          grade: s.grade,
          current_level: s.current_level,
        };
      });
    },
  });

  const upsertMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await (supabase.from("b2b_organizations" as any) as any)
          .update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("b2b_organizations" as any) as any).insert([form]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b-orgs"] });
      toast.success(editing ? "Organization updated" : "Organization created");
      setDialogOpen(false); setEditing(null); setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("b2b_organizations" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b-orgs"] });
      toast.success("Organization deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true);
  }
  function openEdit(o: Org) {
    setEditing(o);
    setForm({
      name: o.name, contact_name: o.contact_name ?? "", contact_email: o.contact_email ?? "",
      contact_phone: o.contact_phone ?? "", seats: o.seats, plan: o.plan ?? "standard",
      status: o.status, notes: o.notes ?? "",
    });
    setDialogOpen(true);
  }

  const stats = useMemo(() => ({
    total: orgs?.length ?? 0,
    active: (orgs ?? []).filter(o => o.status === "active").length,
    seats: (orgs ?? []).reduce((s, o) => s + (o.seats ?? 0), 0),
  }), [orgs]);

  async function exportOrgsCsv() {
    if (!orgs) return;
    await exportAndDownload(
      `pixo-b2b-orgs-${new Date().toISOString().slice(0, 10)}`,
      orgs,
      [
        { key: "name", label: "Organization" },
        { key: "contact_name", label: "Contact Name" },
        { key: "contact_email", label: "Contact Email" },
        { key: "contact_phone", label: "Contact Phone" },
        { key: "seats", label: "Seats" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created" },
      ],
      "b2b_organizations",
    );
    toast.success("B2B CSV exported");
  }

  const selectedOrg = orgs?.find(o => o.id === selectedOrgId);

  return (
    <AdminLayout title="B2B Organizations" subtitle="School & enterprise accounts">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Organizations</p><p className="text-3xl font-bold mt-1">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Active</p><p className="text-3xl font-bold mt-1">{stats.active}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Total Seats</p><p className="text-3xl font-bold mt-1">{stats.seats}</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="orgs">Organizations</TabsTrigger>
            <TabsTrigger value="members" disabled={!selectedOrgId}>
              Members {selectedOrg ? `· ${selectedOrg.name}` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orgs" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> All Organizations</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportOrgsCsv}>
                      <Download className="h-3 w-3" /> Export
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-8 text-xs gap-1" onClick={openCreate}>
                          <Plus className="h-3 w-3" /> Add Org
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{editing ? "Edit Organization" : "New Organization"}</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-3 py-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Name *</Label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Contact Name</Label>
                            <Input value={form.contact_name ?? ""} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Contact Email</Label>
                            <Input type="email" value={form.contact_email ?? ""} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Contact Phone</Label>
                            <Input value={form.contact_phone ?? ""} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Seats</Label>
                            <Input type="number" min={0} value={form.seats} onChange={e => setForm({ ...form, seats: parseInt(e.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Plan</Label>
                            <Select value={form.plan ?? "standard"} onValueChange={v => setForm({ ...form, plan: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="starter">Starter</SelectItem>
                                <SelectItem value="standard">Standard</SelectItem>
                                <SelectItem value="premium">Premium</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="paused">Paused</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Notes</Label>
                            <Textarea rows={3} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                          <Button onClick={() => upsertMut.mutate()} disabled={!form.name || upsertMut.isPending}>
                            {upsertMut.isPending ? "Saving..." : editing ? "Update" : "Create"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <LoadingSpinner /> : (orgs ?? []).length === 0 ? (
                  <EmptyState icon={Building2} title="No organizations yet" description="Add your first B2B organization to start tracking seats and members." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">Organization</TableHead>
                        <TableHead className="font-mono-label">Contact</TableHead>
                        <TableHead className="font-mono-label">Seats</TableHead>
                        <TableHead className="font-mono-label">Plan</TableHead>
                        <TableHead className="font-mono-label">Status</TableHead>
                        <TableHead className="font-mono-label text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(orgs ?? []).map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs font-medium">{o.name}</TableCell>
                          <TableCell className="text-xs">
                            <div>{o.contact_name ?? "—"}</div>
                            <div className="text-muted-foreground">{o.contact_email ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-xs">{o.seats}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] capitalize">{o.plan}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={o.status === "active" ? "default" : "secondary"} className="text-[9px] capitalize">
                              {o.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setSelectedOrgId(o.id); setActiveTab("members"); }}>
                              <Users className="h-3 w-3" /> Members
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7" onClick={() => openEdit(o)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Delete ${o.name}?`)) deleteMut.mutate(o.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" /> Members of {selectedOrg?.name ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!members ? <LoadingSpinner /> : members.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No members linked yet"
                    description="Link students to this org by setting b2b_org_id on their student_profiles row."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">Student</TableHead>
                        <TableHead className="font-mono-label">Email</TableHead>
                        <TableHead className="font-mono-label">Grade</TableHead>
                        <TableHead className="font-mono-label">Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map(m => (
                        <TableRow key={m.user_id}>
                          <TableCell className="text-xs font-medium">{m.full_name}</TableCell>
                          <TableCell className="text-xs">{m.email ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.grade ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.current_level ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
