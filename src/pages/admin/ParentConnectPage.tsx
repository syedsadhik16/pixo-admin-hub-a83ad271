import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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

const toneOptions = [
  { value: "empowering", label: "Empowering", desc: "Encouraging and strength-focused" },
  { value: "direct", label: "Direct", desc: "Clear and actionable feedback" },
  { value: "academic", label: "Academic", desc: "Formal and data-driven" },
  { value: "playful", label: "Playful", desc: "Light and engaging tone" },
];

export default function ParentConnectPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-parent-connect"],
    queryFn: async () => {
      const { data } = await supabase.from("parent_connect_settings").select("*").limit(1).maybeSingle();
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
      const defaults: Record<string, boolean> = {};
      insightOptions.forEach(o => defaults[o.key] = true);
      setForm(f => ({ ...f, visibility_flags: defaults }));
    }
  }, [settings]);

  const persist = useCallback(async (updates: Partial<typeof form>) => {
    const newForm = { ...form, ...updates };
    setForm(newForm);
    try {
      if (settings?.id) {
        const { error } = await supabase.from("parent_connect_settings").update({ ...newForm, updated_by: user?.id }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parent_connect_settings").insert({ ...newForm, updated_by: user?.id });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-parent-connect"] });
    } catch (e: any) {
      toast.error(e.message);
      if (settings) {
        setForm({
          visibility_flags: (settings.visibility_flags as Record<string, boolean>) ?? {},
          intervention_enabled: settings.intervention_enabled ?? false,
          ai_tone: settings.ai_tone ?? "empowering",
        });
      }
    }
  }, [form, settings, user?.id, queryClient]);

  const toggleVisibility = (key: string) => {
    const newFlags = { ...form.visibility_flags, [key]: !form.visibility_flags[key] };
    persist({ visibility_flags: newFlags });
  };

  if (isLoading) return <AdminLayout title="Parent Connect Control"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="Parent Connect Control" subtitle="Control parent portal visibility and insights">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />Visibility of Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insightOptions.map(opt => (
                <div key={opt.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs">{opt.label}</Label>
                  </div>
                  <Switch checked={form.visibility_flags[opt.key] ?? true} onCheckedChange={() => toggleVisibility(opt.key)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-pixo-red" />Intervention Logic</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-xs">Parent Intervention Feature</Label>
                    <p className="text-[10px] text-muted-foreground">Auto-trigger parent alerts on risk signals</p>
                  </div>
                  <Switch checked={form.intervention_enabled} onCheckedChange={v => persist({ intervention_enabled: v })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />AI Advisor Tone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {toneOptions.map(tone => (
                    <button key={tone.value} onClick={() => persist({ ai_tone: tone.value })}
                      className={`p-3 rounded-lg border text-left transition-all ${form.ai_tone === tone.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/30"}`}>
                      <p className="text-xs font-medium">{tone.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{tone.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
