import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Plus, Eye, EyeOff, Play, GitCommit, Tag, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SLOT_TYPES = ["Sound Play", "Word Building", "Reading", "Speak & Copy", "Action English", "Fun Recall"];

export default function CurriculumPage() {
  const queryClient = useQueryClient();
  const [activeLevel, setActiveLevel] = useState("beginner");
  const [createDayOpen, setCreateDayOpen] = useState(false);
  const [_selectedDay, setSelectedDay] = useState<any>(null);

  const { data: levels } = useQuery({
    queryKey: ["cur-levels"],
    queryFn: async () => {
      const { data } = await supabase.from("curriculum_levels").select("*").order("display_order");
      return data ?? [];
    },
  });

  const { data: days, isLoading: daysLoading } = useQuery({
    queryKey: ["cur-days", activeLevel],
    queryFn: async () => {
      const level = levels?.find(l => l.level_key === activeLevel);
      if (!level) return [];
      const { data } = await supabase
        .from("curriculum_days")
        .select("*, curriculum_day_parts(*)")
        .eq("level_id", level.id)
        .order("day_number");
      return data ?? [];
    },
    enabled: !!levels && levels.length > 0,
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { error } = await supabase.from("curriculum_days").update({ is_published: !is_published }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cur-days"] });
      toast.success("Publish status updated");
    },
  });

  const [newDay, setNewDay] = useState({ title: "", theme: "", objective: "", day_number: 1, xp_reward: 10, is_free: false });

  const createDay = useMutation({
    mutationFn: async () => {
      const level = levels?.find(l => l.level_key === activeLevel);
      if (!level) throw new Error("No level selected");
      const { error } = await supabase.from("curriculum_days").insert({
        level_id: level.id,
        day_number: newDay.day_number,
        title: newDay.title,
        theme: newDay.theme,
        objective: newDay.objective,
        xp_reward: newDay.xp_reward,
        is_free: newDay.is_free,
        is_published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cur-days"] });
      toast.success("Curriculum day created");
      setCreateDayOpen(false);
      setNewDay({ title: "", theme: "", objective: "", day_number: 1, xp_reward: 10, is_free: false });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const levelTabs = levels && levels.length > 0 ? levels : [
    { level_key: "beginner", title: "Beginner" },
    { level_key: "intermediate", title: "Intermediate" },
    { level_key: "advanced", title: "Advanced" },
  ];

  return (
    <AdminLayout title="Curriculum Control Center" subtitle="Manage learning architecture across all stages">
      <div className="space-y-6 animate-fade-in">
        {/* Level selector + add */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Tabs value={activeLevel} onValueChange={setActiveLevel}>
            <TabsList className="bg-muted/50">
              {levelTabs.map((l: any) => (
                <TabsTrigger key={l.level_key} value={l.level_key} className="text-xs font-medium uppercase tracking-wider">
                  {l.title}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono-label text-[9px]">
              {days?.length ?? 0} DAYS
            </Badge>
            <Dialog open={createDayOpen} onOpenChange={setCreateDayOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Add Day
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Curriculum Day</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Day Number</Label>
                      <Input type="number" value={newDay.day_number} onChange={e => setNewDay(d => ({ ...d, day_number: +e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">XP Reward</Label>
                      <Input type="number" value={newDay.xp_reward} onChange={e => setNewDay(d => ({ ...d, xp_reward: +e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Title</Label>
                    <Input value={newDay.title} onChange={e => setNewDay(d => ({ ...d, title: e.target.value }))} placeholder="e.g. Introduction to Vowels" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Theme</Label>
                    <Input value={newDay.theme} onChange={e => setNewDay(d => ({ ...d, theme: e.target.value }))} placeholder="e.g. Phonics Basics" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Objective</Label>
                    <Textarea value={newDay.objective} onChange={e => setNewDay(d => ({ ...d, objective: e.target.value }))} placeholder="Learning objective..." rows={2} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={newDay.is_free} onCheckedChange={v => setNewDay(d => ({ ...d, is_free: v }))} />
                    <Label className="text-xs">Free content (no premium required)</Label>
                  </div>
                  <Button onClick={() => createDay.mutate()} disabled={createDay.isPending} className="w-full">
                    {createDay.isPending ? "Creating..." : "Create Day"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Day Timeline */}
        {daysLoading ? (
          <LoadingSpinner />
        ) : !days || days.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState icon={BookOpen} title="No curriculum days for this stage" description="Click 'Add Day' to create the first lesson in this level" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Day cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {days.map((day: any) => (
                <Card key={day.id} className="group hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedDay(day)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {day.day_number}
                        </div>
                        <div>
                          <CardTitle className="text-sm">{day.title || `Day ${day.day_number}`}</CardTitle>
                          {day.theme && <p className="font-mono-label text-muted-foreground mt-0.5">{day.theme}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {day.is_free && <StatusBadge status="active" className="!text-[8px]" />}
                        <StatusBadge status={day.is_published ? "published" : "draft"} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {day.objective && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{day.objective}</p>}
                    
                    {/* 6-slot block grid */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {SLOT_TYPES.map((slot, i) => {
                        const part = day.curriculum_day_parts?.find((p: any) => p.part_number === i + 1);
                        return (
                          <div key={slot} className={`rounded p-1.5 text-center ${part ? "bg-primary/10 border border-primary/20" : "bg-muted/50 border border-transparent"}`}>
                            <p className="text-[8px] font-medium truncate">{slot}</p>
                            <p className="text-[7px] text-muted-foreground">3 min</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                      <span>{day.curriculum_day_parts?.length ?? 0} parts</span>
                      <span>{day.xp_reward} XP</span>
                      <span className="font-mono">v{day.version_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); togglePublish.mutate({ id: day.id, is_published: day.is_published }); }}
                      >
                        {day.is_published ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                        {day.is_published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Atomic Override + Manifest Commit */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Atomic Override
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["Intro Sequence", "Core Sequence", "Recovery Sequence"].map(seq => (
                    <div key={seq} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium">{seq}</p>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                          <Plus className="h-2.5 w-2.5" />
                          Add Manual Node
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono-label text-[8px]">Audio Node</Badge>
                        <Badge className="bg-primary/10 text-primary border-0 font-mono-label text-[8px]">Source: AI</Badge>
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto">
                          <Play className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="pixo-dark-card">
                <div className="flex items-center gap-2 mb-4">
                  <GitCommit className="h-4 w-4 text-pixo-green" />
                  <h3 className="text-sm font-semibold text-sidebar-foreground">Manifest Commit</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-sidebar-foreground/70">Atomic Override Ready</span>
                    <StatusBadge status="on_track" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-sidebar-foreground/70">Pending Delta</span>
                    <span className="font-mono-label text-sidebar-foreground">{days?.filter((d: any) => !d.is_published).length ?? 0} unpublished</span>
                  </div>
                  <Button className="w-full mt-2 gap-1.5" size="sm">
                    <GitCommit className="h-3.5 w-3.5" />
                    Commit Manifest
                  </Button>
                  <div className="pt-2 border-t border-sidebar-border">
                    <p className="font-mono-label text-sidebar-foreground/50 mb-2">Skill Mastery Bindings</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-[9px] border-sidebar-border text-sidebar-foreground/70">phonics</Badge>
                      <Badge variant="outline" className="text-[9px] border-sidebar-border text-sidebar-foreground/70">vocabulary</Badge>
                      <Badge variant="outline" className="text-[9px] border-sidebar-border text-sidebar-foreground/70">fluency</Badge>
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] text-sidebar-foreground/50 px-1.5">
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
