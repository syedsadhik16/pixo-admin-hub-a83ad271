import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Search, Users } from "lucide-react";

export function StudentsTab() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-students-full"],
    queryFn: async () => {
      const [studentsRes, profilesRes, progressRes, entRes] = await Promise.all([
        supabase.from("student_profiles").select("user_id, current_level, active_plan, grade, age"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("student_progress").select("student_user_id, current_day, completed_days, streak_count, confidence_score, accuracy_score"),
        supabase.from("user_entitlements").select("user_id, plan_name, is_active"),
      ]);

      const profMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
      const progMap = new Map((progressRes.data ?? []).map(p => [p.student_user_id, p]));
      const entMap = new Map((entRes.data ?? []).map(e => [e.user_id, e]));

      return (studentsRes.data ?? []).map(s => {
        const p = profMap.get(s.user_id);
        const progress = progMap.get(s.user_id);
        const ent = entMap.get(s.user_id);
        const xp = (progress?.completed_days ?? 0) * 50;
        return {
          user_id: s.user_id,
          name: p?.full_name ?? "—",
          email: p?.email ?? "—",
          level: s.current_level ?? "—",
          xp,
          streak: progress?.streak_count ?? 0,
          subscription: ent?.is_active ? (ent.plan_name ?? "active") : "free",
          completedDays: progress?.completed_days ?? 0,
          currentDay: progress?.current_day ?? 0,
          confidence: Number(progress?.confidence_score ?? 0),
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter(s => {
      if (levelFilter !== "all" && s.level !== levelFilter) return false;
      if (search) {
        const t = search.toLowerCase();
        if (!s.name.toLowerCase().includes(t) && !s.email.toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }, [data, levelFilter, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Student Registry
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs w-48"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No students" description="No student profiles match the current filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono-label">Name</TableHead>
                <TableHead className="font-mono-label">Email</TableHead>
                <TableHead className="font-mono-label">Level</TableHead>
                <TableHead className="font-mono-label">XP</TableHead>
                <TableHead className="font-mono-label">Streak</TableHead>
                <TableHead className="font-mono-label">Subscription</TableHead>
                <TableHead className="font-mono-label">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.user_id}>
                  <TableCell className="text-xs font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-xs capitalize">{s.level}</TableCell>
                  <TableCell className="text-xs">{s.xp.toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{s.streak}🔥</TableCell>
                  <TableCell><Badge variant={s.subscription === "free" ? "outline" : "default"} className="capitalize">{s.subscription}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <Progress value={Math.min((s.currentDay / 180) * 100, 100)} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground font-mono w-16 text-right">
                        {s.completedDays}/{s.currentDay || 180}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
