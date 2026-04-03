import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, ChevronRight, Eye, EyeOff, GripVertical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function CurriculumPage() {
  const queryClient = useQueryClient();
  const [activeLevel, setActiveLevel] = useState("beginner");
  const [createDayOpen, setCreateDayOpen] = useState(false);

  const { data: levels } = useQuery({
    queryKey: ["admin-curriculum-levels"],
    queryFn: async () => {
      const { data } = await supabase.from("curriculum_levels").select("*").order("display_order");
      return data ?? [];
    },
  });

  const { data: days, isLoading: daysLoading } = useQuery({
    queryKey: ["admin-curriculum-days", activeLevel],
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
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum-days"] });
      toast.success("Day updated");
    },
  });

  // New day form state
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
      queryClient.invalidateQueries({ queryKey: ["admin-curriculum-days"] });
      toast.success("Day created");
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
    <AdminLayout title="Curriculum Control Center" subtitle="Manage learning content across all levels">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Tabs value={activeLevel} onValueChange={setActiveLevel}>
            <TabsList>
              {levelTabs.map((l: any) => (
                <TabsTrigger key={l.level_key} value={l.level_key} className="text-xs">{l.title}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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

        {/* Days grid */}
        {daysLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !days || days.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No curriculum days for this level yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Day" to create the first lesson</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days.map((day: any) => (
              <Card key={day.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {day.day_number}
                      </div>
                      <div>
                        <CardTitle className="text-sm">{day.title || `Day ${day.day_number}`}</CardTitle>
                        {day.theme && <p className="text-[10px] text-muted-foreground">{day.theme}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {day.is_free && <Badge variant="outline" className="text-[9px] text-pixo-green border-pixo-green/30">FREE</Badge>}
                      <Badge variant="outline" className={`text-[9px] ${day.is_published ? "text-pixo-green border-pixo-green/30" : "text-muted-foreground"}`}>
                        {day.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {day.objective && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{day.objective}</p>}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                    <span>{day.curriculum_day_parts?.length ?? 0} parts</span>
                    <span>{day.xp_reward} XP</span>
                    <span>v{day.version_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-7"
                      onClick={() => togglePublish.mutate({ id: day.id, is_published: day.is_published })}
                    >
                      {day.is_published ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                      {day.is_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      Edit <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
