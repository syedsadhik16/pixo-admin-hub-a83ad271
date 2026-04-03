import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Save, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

const insightOptions = [
  { key: "speaking_time", label: "Speaking Time" },
  { key: "accuracy", label: "Accuracy Score" },
  { key: "fluency", label: "Fluency Score" },
  { key: "confidence", label: "Confidence Score" },
  { key: "daily_streak", label: "Daily Streak" },
  { key: "xp_history", label: "XP History" },
];

export default function ParentConnectPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-parent-connect"],
    queryFn: async () => {
      const { data } = await supabase.from("parent_connect_settings").select("*").limit(1).single();
      return data;
    },
  });

  const [form, setForm] = useState({
    visibility_flags: {} as Record<string, boolean>,
    intervention_enabled: false,
    ai_tone: "empowering",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        visibility_flags: (settings.visibility_flags as Record<string, boolean>) ?? {},
        intervention_enabled: settings.intervention_enabled ?? false,
        ai_tone: settings.ai_tone ?? "empowering",
      });
    } else {
      // Default all visible
      const defaults: Record<string, boolean> = {};
      insightOptions.forEach(o => defaults[o.key] = true);
      setForm(f => ({ ...f, visibility_flags: defaults }));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase.from("parent_connect_settings").update({ ...form, updated_by: user?.id }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parent_connect_settings").insert({ ...form, updated_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-parent-connect"] });
      toast.success("Parent Connect settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleVisibility = (key: string) => {
    setForm(f => ({
      ...f,
      visibility_flags: { ...f.visibility_flags, [key]: !f.visibility_flags[key] },
    }));
  };

  return (
    <AdminLayout title="Parent Connect Control" subtitle="Control parent portal visibility and insights">
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-pixo-purple" />Visibility Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insightOptions.map(opt => (
                  <div key={opt.key} className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                    <Label className="text-xs">{opt.label}</Label>
                    <Switch checked={form.visibility_flags[opt.key] ?? true} onCheckedChange={() => toggleVisibility(opt.key)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-pixo-red" />Intervention & Tone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                    <div>
                      <Label className="text-xs">Intervention Logic</Label>
                      <p className="text-[10px] text-muted-foreground">Auto-trigger parent alerts on risk signals</p>
                    </div>
                    <Switch checked={form.intervention_enabled} onCheckedChange={v => setForm(f => ({ ...f, intervention_enabled: v }))} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">AI Assistant Tone</Label>
                    <Select value={form.ai_tone} onValueChange={v => setForm(f => ({ ...f, ai_tone: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empowering">Empowering</SelectItem>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="playful">Playful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Saving..." : "Save & Publish"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
