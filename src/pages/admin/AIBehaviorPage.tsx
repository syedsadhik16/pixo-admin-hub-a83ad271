import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Brain, Save, Zap, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function AIBehaviorPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_behavior_settings").select("*").eq("is_active", true).limit(1).single();
      return data;
    },
  });

  const [form, setForm] = useState({
    persona: "spark",
    correction_mode: "praise_then_correct",
    confidence_priority: true,
    max_corrections: 3,
    accuracy_strictness: 5,
    system_prompt: "",
    preview_prompt: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        persona: settings.persona ?? "spark",
        correction_mode: settings.correction_mode ?? "praise_then_correct",
        confidence_priority: settings.confidence_priority ?? true,
        max_corrections: settings.max_corrections ?? 3,
        accuracy_strictness: settings.accuracy_strictness ?? 5,
        system_prompt: settings.system_prompt ?? "",
        preview_prompt: settings.preview_prompt ?? "",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (settings?.id) {
        const { error } = await supabase.from("ai_behavior_settings").update({ ...form, updated_by: user?.id }).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_behavior_settings").insert({ ...form, is_active: true, updated_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      toast.success("AI behavior saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const personas = [
    { value: "spark", label: "Spark: The Action Expert", desc: "High energy, action-oriented learning guide" },
    { value: "nova", label: "Nova: Cosmic Guide", desc: "Curious, exploration-focused mentor" },
    { value: "bloom", label: "Bloom: Growth Mentor", desc: "Nurturing, growth-mindset companion" },
  ];

  return (
    <AdminLayout title="AI Behavior Brain" subtitle="Configure AI personality and correction logic">
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Persona */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-pixo-purple" />AI Persona</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {personas.map(p => (
                      <button
                        key={p.value}
                        onClick={() => setForm(f => ({ ...f, persona: p.value }))}
                        className={`p-3 rounded-lg border text-left transition-all ${form.persona === p.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/30"}`}
                      >
                        <p className="text-xs font-medium">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Correction Mode */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Correction & Feedback Logic</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Correction Mode</Label>
                    <Select value={form.correction_mode} onValueChange={v => setForm(f => ({ ...f, correction_mode: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="praise_then_correct">Praise Then Correct</SelectItem>
                        <SelectItem value="direct_correction">Direct Correction</SelectItem>
                        <SelectItem value="never_correct">Never Correct</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">Confidence Priority</Label>
                      <p className="text-[10px] text-muted-foreground">Prioritize building confidence over strict accuracy</p>
                    </div>
                    <Switch checked={form.confidence_priority} onCheckedChange={v => setForm(f => ({ ...f, confidence_priority: v }))} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Corrections per Session: {form.max_corrections}</Label>
                    <Slider value={[form.max_corrections]} onValueChange={v => setForm(f => ({ ...f, max_corrections: v[0] }))} min={0} max={10} step={1} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Accuracy Strictness: {form.accuracy_strictness}/10</Label>
                    <Slider value={[form.accuracy_strictness]} onValueChange={v => setForm(f => ({ ...f, accuracy_strictness: v[0] }))} min={1} max={10} step={1} />
                  </div>
                </CardContent>
              </Card>

              {/* System Prompt */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">System Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Global System Prompt</Label>
                    <Textarea value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))} rows={5} placeholder="Enter the system instruction for the AI..." className="text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Preview Prompt</Label>
                    <Textarea value={form.preview_prompt} onChange={e => setForm(f => ({ ...f, preview_prompt: e.target.value }))} rows={3} placeholder="Test prompt for preview..." className="text-xs" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Live Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-pixo-surface p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-full pixo-gradient flex items-center justify-center">
                        <Zap className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">{personas.find(p => p.value === form.persona)?.label ?? "AI"}</p>
                        <p className="text-[10px] text-muted-foreground">{form.correction_mode.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Confidence priority: {form.confidence_priority ? "ON" : "OFF"}</p>
                      <p>Max corrections: {form.max_corrections}</p>
                      <p>Strictness: {form.accuracy_strictness}/10</p>
                    </div>
                  </div>
                  {settings && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge className="bg-pixo-green/10 text-pixo-green border-0 text-[10px]">Active Version</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(settings.updated_at).toLocaleString()}</span>
                    </div>
                  )}
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
