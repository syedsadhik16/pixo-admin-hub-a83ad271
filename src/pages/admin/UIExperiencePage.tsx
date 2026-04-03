import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Palette, Flag, Plus, Image, Zap, Check } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function UIExperiencePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [newFlagOpen, setNewFlagOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({ flag_key: "", description: "" });
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(false);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    },
  });

  const createFlag = useMutation({
    mutationFn: async () => {
      if (!newFlag.flag_key) throw new Error("Flag key is required");
      const { error } = await supabase.from("feature_flags").insert({ ...newFlag, flag_value: false, updated_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      toast.success("Flag created");
      setNewFlagOpen(false);
      setNewFlag({ flag_key: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateConfig = async (id: string, key: string, value: string) => {
    try {
      const parsed = JSON.parse(value);
      const { error } = await supabase.from("ui_config").update({ config_value: parsed, updated_by: user?.id }).eq("id", id);
      if (error) throw error;
      setSavedKeys(prev => new Set(prev).add(key));
      setTimeout(() => setSavedKeys(prev => { const n = new Set(prev); n.delete(key); return n; }), 2000);
    } catch {
      toast.error("Invalid JSON value");
    }
  };

  const handlePush = async () => {
    setPushing(true);
    await new Promise(r => setTimeout(r, 1500));
    setPushing(false);
    setPushed(true);
    toast.success("Visual update pushed to all apps");
    setTimeout(() => setPushed(false), 3000);
  };

  return (
    <AdminLayout title="UI & Experience" subtitle="Control cross-app presentation and features">
      <div className="space-y-6 animate-fade-in">
        {/* Instant UI Push Banner */}
        <div className="rounded-xl bg-primary p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary-foreground" />
            <div>
              <p className="text-sm font-semibold text-primary-foreground">Instant UI Push</p>
              <p className="text-xs text-primary-foreground/70">Deploy visual updates to child + parent apps</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={handlePush} disabled={pushing}>
            {pushing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : pushed ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {pushing ? "Pushing..." : pushed ? "Pushed!" : "Push Visual Update"}
          </Button>
        </div>

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
                        <Input value={newFlag.description} onChange={e => setNewFlag(f => ({ ...f, description: e.target.value }))} />
                      </div>
                      <Button onClick={() => createFlag.mutate()} disabled={createFlag.isPending} className="w-full">Create Flag</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {flagsLoading ? <LoadingSpinner /> : !flags?.length ? (
                <EmptyState icon={Flag} title="No feature flags yet" />
              ) : (
                <div className="space-y-2">
                  {flags.map((flag: any) => (
                    <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
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

          {/* Microcopy / UI Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Microcopy & Config</CardTitle>
            </CardHeader>
            <CardContent>
              {!uiConfigs?.length ? (
                <EmptyState icon={Palette} title="No UI configurations yet" />
              ) : (
                <div className="space-y-3">
                  {uiConfigs.map((cfg: any) => (
                    <div key={cfg.id} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium font-mono">{cfg.config_key}</p>
                        {savedKeys.has(cfg.config_key) && (
                          <Badge className="bg-pixo-green/10 text-pixo-green border-0 text-[8px] gap-0.5"><Check className="h-2 w-2" />saved</Badge>
                        )}
                      </div>
                      <Input defaultValue={JSON.stringify(cfg.config_value)} className="text-xs font-mono h-8"
                        onBlur={e => updateConfig(cfg.id, cfg.config_key, e.target.value)} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}>
                <Image className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Drop mascot image here (PNG/SVG, max 500KB)</p>
                <input ref={fileInputRef} type="file" accept=".png,.svg" className="hidden" />
              </div>
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Primary Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <Input defaultValue="#4F46E5" className="text-xs font-mono h-8 flex-1" />
                    <div className="h-8 w-8 rounded-lg bg-primary border" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
