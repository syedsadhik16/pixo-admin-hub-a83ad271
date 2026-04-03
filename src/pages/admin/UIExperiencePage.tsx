import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette, Flag, Save, Plus, Image } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function UIExperiencePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [newFlagOpen, setNewFlagOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({ flag_key: "", description: "" });

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("*").order("flag_key");
      return data ?? [];
    },
  });

  const { data: uiConfigs } = useQuery({
    queryKey: ["admin-ui-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ui_config").select("*").order("config_key");
      return data ?? [];
    },
  });

  const toggleFlag = useMutation({
    mutationFn: async ({ id, flag_value }: { id: string; flag_value: boolean }) => {
      const { error } = await supabase.from("feature_flags").update({ flag_value: !flag_value, updated_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      toast.success("Flag updated");
    },
  });

  const createFlag = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feature_flags").insert({ ...newFlag, flag_value: false, updated_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      toast.success("Flag created");
      setNewFlagOpen(false);
      setNewFlag({ flag_key: "", description: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminLayout title="UI & Experience" subtitle="Control cross-app presentation and features">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Flag className="h-4 w-4 text-pixo-blue" />Feature Flags</CardTitle>
                <Dialog open={newFlagOpen} onOpenChange={setNewFlagOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-xs gap-1"><Plus className="h-3 w-3" />Add Flag</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Feature Flag</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Flag Key</Label>
                        <Input value={newFlag.flag_key} onChange={e => setNewFlag(f => ({ ...f, flag_key: e.target.value }))} placeholder="e.g. enable_new_dashboard" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Input value={newFlag.description} onChange={e => setNewFlag(f => ({ ...f, description: e.target.value }))} placeholder="What does this flag control?" />
                      </div>
                      <Button onClick={() => createFlag.mutate()} disabled={createFlag.isPending} className="w-full">Create Flag</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {flagsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : !flags || flags.length === 0 ? (
                <div className="text-center py-8">
                  <Flag className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No feature flags yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flags.map((flag: any) => (
                    <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                      <div>
                        <p className="text-xs font-medium font-mono">{flag.flag_key}</p>
                        {flag.description && <p className="text-[10px] text-muted-foreground">{flag.description}</p>}
                      </div>
                      <Switch checked={flag.flag_value} onCheckedChange={() => toggleFlag.mutate({ id: flag.id, flag_value: flag.flag_value })} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* UI Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-pixo-purple" />UI Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {!uiConfigs || uiConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <Palette className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No UI configurations yet</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Add microcopy, theme tokens, or app messages here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uiConfigs.map((cfg: any) => (
                    <div key={cfg.id} className="p-3 rounded-lg bg-pixo-surface">
                      <p className="text-xs font-medium font-mono">{cfg.config_key}</p>
                      <pre className="text-[10px] text-muted-foreground mt-1 overflow-auto">{JSON.stringify(cfg.config_value, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Brand Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Image className="h-4 w-4 text-pixo-amber" />Brand Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Image className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Drop brand assets here or click to upload</p>
              <p className="text-[10px] text-muted-foreground mt-1">Logos, mascots, icons — stored in brand-assets bucket</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
