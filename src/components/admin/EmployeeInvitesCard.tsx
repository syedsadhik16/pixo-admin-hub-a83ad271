import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Copy, Trash2, Briefcase, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/EmptyState";

const OFFICE_ROLES = ["admin", "hr", "developer", "ops", "support", "content", "staff"];
const COMMISSION_ROLES = ["sales", "field_sales", "tele_sales", "partner"];

function genToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function EmployeeInvitesCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "used" | "revoked">("all");
  const [form, setForm] = useState({
    category: "office" as "office" | "commission",
    designation: "",
    preset_role: "",
    invited_email: "",
    notes: "",
  });

  const { data: invites } = useQuery({
    queryKey: ["employee-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const token = genToken();
      const { data, error } = await supabase.from("employee_invites").insert({
        token,
        category: form.category,
        designation: form.designation || null,
        preset_role: form.preset_role || null,
        invited_email: form.invited_email || null,
        notes: form.notes || null,
        created_by: user.id,
      }).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["employee-invites"] });
      const link = `${window.location.origin}/join/${data.token}`;
      setGenerated(link);
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invite link generated and copied");
      setForm({ category: "office", designation: "", preset_role: "", invited_email: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_invites")
        .update({ status: "revoked" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-invites"] });
      toast.success("Invite revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleOptions = form.category === "commission" ? COMMISSION_ROLES : OFFICE_ROLES;
  const pending = invites?.filter((i: any) => i.status === "pending") ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Employee Onboarding Invites
        </CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setGenerated(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> Generate Invite Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Generate One-Time Invite Link</DialogTitle></DialogHeader>
            {generated ? (
              <div className="space-y-3">
                <Label className="text-xs">Share this link with the new employee:</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generated} className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(generated); toast.success("Copied"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  ✅ One-time use · Expires after first signup · Cannot be reused.
                </p>
                <Button onClick={() => { setOpen(false); setGenerated(null); }} className="w-full">Done</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: "office", preset_role: "" }))}
                    className={`p-3 rounded border text-left transition ${form.category === "office" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <Briefcase className="h-4 w-4 mb-1 text-primary" />
                    <div className="text-xs font-medium">Office Staff</div>
                    <div className="text-[10px] text-muted-foreground">Admin, HR, Developer, Ops</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: "commission", preset_role: "" }))}
                    className={`p-3 rounded border text-left transition ${form.category === "commission" ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <TrendingUp className="h-4 w-4 mb-1 text-primary" />
                    <div className="text-xs font-medium">Commission Sales</div>
                    <div className="text-[10px] text-muted-foreground">Earns commission on revenue</div>
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preset Role (optional)</Label>
                  <Select value={form.preset_role} onValueChange={(v) => setForm((f) => ({ ...f, preset_role: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Let employee choose" /></SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Designation (optional)</Label>
                  <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. Senior Sales Executive" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Invitee Email (optional, locks the email)</Label>
                  <Input type="email" value={form.invited_email} onChange={(e) => setForm((f) => ({ ...f, invited_email: e.target.value }))} />
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
                  {create.isPending ? "Generating..." : "Generate Link"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs gap-1.5">
              All <Badge variant="secondary" className="text-[9px] h-4 px-1">{invites?.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs gap-1.5">
              <Clock className="h-3 w-3" /> Pending
              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                {invites?.filter((i: any) => i.status === "pending").length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="used" className="text-xs gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Used
              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                {invites?.filter((i: any) => i.status === "used").length ?? 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="revoked" className="text-xs gap-1.5">
              <XCircle className="h-3 w-3" /> Revoked
              <Badge variant="secondary" className="text-[9px] h-4 px-1">
                {invites?.filter((i: any) => i.status === "revoked").length ?? 0}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {(() => {
          const filtered = (invites ?? []).filter((i: any) => filter === "all" || i.status === filter);
          if (filtered.length === 0) {
            return (
              <EmptyState
                icon={Link2}
                title={filter === "all" ? "No invites yet" : `No ${filter} invites`}
                description={filter === "all" ? "Generate a one-time link to onboard a new employee." : "Try a different filter."}
              />
            );
          }
          return (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono-label">Status</TableHead>
                  <TableHead className="font-mono-label">Category</TableHead>
                  <TableHead className="font-mono-label">Role</TableHead>
                  <TableHead className="font-mono-label">Designation</TableHead>
                  <TableHead className="font-mono-label">Invited Email</TableHead>
                  <TableHead className="font-mono-label">Created</TableHead>
                  <TableHead className="font-mono-label">Used At</TableHead>
                  <TableHead className="font-mono-label text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv: any) => {
                  const link = `${window.location.origin}/join/${inv.token}`;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Badge
                          variant={inv.status === "pending" ? "outline" : inv.status === "used" ? "default" : "destructive"}
                          className="text-[10px] capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.category === "commission" ? "default" : "secondary"} className="text-[10px] capitalize">
                          {inv.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{inv.preset_role?.replace("_", " ") || "—"}</TableCell>
                      <TableCell className="text-xs">{inv.designation || "—"}</TableCell>
                      <TableCell className="text-xs">{inv.invited_email || "—"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(inv.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {inv.used_at ? new Date(inv.used_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {inv.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] gap-1"
                                onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}
                              >
                                <Copy className="h-3 w-3" /> Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[11px] gap-1 text-destructive"
                                onClick={() => revoke.mutate(inv.id)}
                                disabled={revoke.isPending}
                              >
                                <Trash2 className="h-3 w-3" /> Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          );
        })()}

        {pending.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {pending.length} pending invite{pending.length === 1 ? "" : "s"} · Each link works only once.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

