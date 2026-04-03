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
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Brain, Save, Zap, Lock, Send } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export default function AIBehaviorPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [learnerInput, setLearnerInput] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-ai-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_behavior_settings").select("*").eq("is_active", true).limit(1).maybeSingle();
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

  const [isDirty, setIsDirty] = useState(false);

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
      setIsDirty(false);
    }
  }, [settings]);

  const updateForm = (updates: Partial<typeof form>) => {
    setForm(f => ({ ...f, ...updates }));
    setIsDirty(true);
  };

  const computedPrompt = useMemo(() => {
    const personaName = personas.find(p => p.value === form.persona)?.label ?? "AI";
    const correctionLabel = form.correction_mode.replace(/_/g, " ");
    const strictness = form.accuracy_strictness <= 3 ? "low" : form.accuracy_strictness <= 7 ? "medium" : "high";
    return `You are ${personaName}. Correction mode: ${correctionLabel}. Confidence priority: ${form.confidence_priority ? "ON" : "OFF"}. Max corrections: ${form.max_corrections}. Accuracy strictness: ${strictness}.`;
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, system_prompt: form.system_prompt || computedPrompt, updated_by: user?.id };
      if (settings?.id) {
        const { error } = await supabase.from("ai_behavior_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_behavior_settings").insert({ ...payload, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ai-settings"] });
      toast.success("AI behavior saved");
      setIsDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AdminLayout title="AI Behavior Brain"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="AI Behavior Brain" subtitle="Configure AI personality and correction logic">
      <div className="space-y-6 animate-fade-in">
        {isDirty && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-pixo-amber/10 border border-pixo-amber/20">
            <span className="text-xs text-pixo-amber font-medium">⚠ Unsaved changes</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-primary" />AI Persona</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {personas.map(p => (
                    <button key={p.value} onClick={() => updateForm({ persona: p.value })}
                      className={`p-3 rounded-lg border text-left transition-all ${form.persona === p.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/30"}`}>
                      <p className="text-xs font-medium">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Correction & Feedback Logic</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Correction Mode</Label>
                  <Select value={form.correction_mode} onValueChange={v => updateForm({ correction_mode: v })}>
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
                  <Switch checked={form.confidence_priority} onCheckedChange={v => updateForm({ confidence_priority: v })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Corrections per Session: {form.max_corrections}</Label>
                  <Slider value={[form.max_corrections]} onValueChange={v => updateForm({ max_corrections: v[0] })} min={0} max={5} step={1} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Accuracy Strictness</Label>
                  <div className="flex gap-2">
                    {["LOW", "MEDIUM", "HIGH"].map((level, i) => {
                      const val = [2, 5, 9][i];
                      const isActive = (form.accuracy_strictness <= 3 && i === 0) || (form.accuracy_strictness > 3 && form.accuracy_strictness <= 7 && i === 1) || (form.accuracy_strictness > 7 && i === 2);
                      return (
                        <Button key={level} variant={isActive ? "default" : "outline"} size="sm" className="flex-1 text-xs h-8"
                          onClick={() => updateForm({ accuracy_strictness: val })}>
                          {level}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  System Instructions
                  <Badge className="bg-pixo-amber/10 text-pixo-amber border-0 text-[9px] gap-1"><Lock className="h-2.5 w-2.5" />SINGLE SOURCE OF TRUTH</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={form.system_prompt || computedPrompt} readOnly rows={4}
                  className="text-xs font-mono bg-sidebar text-sidebar-foreground border-sidebar-border" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="pixo-dark-card">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-sidebar-foreground">Behavior Preview</h3>
                <Badge variant="outline" className="text-[8px] border-sidebar-border text-sidebar-foreground/50">PIXO-v2.1</Badge>
              </div>

              {aiResponse && (
                <div className="rounded-lg bg-sidebar-accent/50 p-3 mb-3">
                  <p className="text-xs text-sidebar-foreground">{aiResponse}</p>
                </div>
              )}

              <div className="space-y-2 text-xs text-sidebar-foreground/70 mb-4 font-mono">
                <p>persona: {form.persona}</p>
                <p>correction: {form.correction_mode}</p>
                <p>confidence_priority: {String(form.confidence_priority)}</p>
                <p>max_corrections: {form.max_corrections}</p>
                <p>strictness: {form.accuracy_strictness}/10</p>
              </div>

              <div className="flex gap-2">
                <Input value={learnerInput} onChange={e => setLearnerInput(e.target.value)} placeholder="Type learner input..."
                  className="text-xs bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30" />
                <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                  if (learnerInput.trim()) {
                    setAiResponse(`Great try! "${learnerInput}" — let me help you with that. ${form.confidence_priority ? "You're doing amazing!" : "Let's work on getting it right."}`);
                    setLearnerInput("");
                  }
                }}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {settings && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Badge className="bg-pixo-green/10 text-pixo-green border-0 text-[10px]">Active</Badge>
                <span>{new Date(settings.updated_at ?? "").toLocaleString()}</span>
              </div>
            )}

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-1.5">
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Saving..." : "Save & Publish"}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

const personas = [
  { value: "spark", label: "Spark: The Action Expert", desc: "High energy, action-oriented learning guide" },
  { value: "nova", label: "Nova: Cosmic Guide", desc: "Curious, exploration-focused mentor" },
  { value: "bloom", label: "Bloom: Growth Mentor", desc: "Nurturing, growth-mindset companion" },
];
