import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { TrendingUp, Search, Download } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

interface ProgressRow {
  user_id: string;
  name: string;
  grade: string;
  level: string;
  current_day: number;
  completed_days: number;
  xp: number;
  streak: number;
  confidence: number;
  accuracy: number;
  fluency: number;
  engagement: number;
  last_active: string | null;
  weak: boolean;
}

export default function ProgressPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-progress"],
    queryFn: async (): Promise<ProgressRow[]> => {
      const [studentsRes, profilesRes, progressRes] = await Promise.all([
        supabase.from("student_profiles").select("user_id, current_level, grade"),
        supabase.from("profiles").select("id, full_name, last_login_at"),
        supabase.from("student_progress").select("*"),
      ]);
      const profMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
      const progMap = new Map((progressRes.data ?? []).map(p => [p.student_user_id, p]));

      return (studentsRes.data ?? []).map(s => {
        const prof = profMap.get(s.user_id);
        const prog = progMap.get(s.user_id);
        const confidence = Number(prog?.confidence_score ?? 0);
        const accuracy = Number(prog?.accuracy_score ?? 0);
        return {
          user_id: s.user_id,
          name: prof?.full_name ?? "—",
          grade: s.grade ?? "—",
          level: s.current_level ?? "—",
          current_day: prog?.current_day ?? 0,
          completed_days: prog?.completed_days ?? 0,
          xp: (prog?.completed_days ?? 0) * 50,
          streak: prog?.streak_count ?? 0,
          confidence,
          accuracy,
          fluency: Number(prog?.fluency_score ?? 0),
          engagement: Number(prog?.engagement_score ?? 0),
          last_active: (prof as any)?.last_login_at ?? prog?.updated_at ?? null,
          weak: confidence < 40 || accuracy < 40,
        };
      });
    },
  });

  const filtered = useMemo(() => (data ?? []).filter(r => {
    if (levelFilter !== "all" && r.level !== levelFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [data, levelFilter, search]);

  async function exportCsv() {
    await exportAndDownload(
      `pixo-progress-${new Date().toISOString().slice(0, 10)}`,
      filtered,
      [
        { key: "name", label: "Student" },
        { key: "grade", label: "Grade" },
        { key: "level", label: "Level" },
        { key: "current_day", label: "Current Day" },
        { key: "completed_days", label: "Completed Days" },
        { key: "xp", label: "XP" },
        { key: "streak", label: "Streak" },
        { key: "confidence", label: "Confidence" },
        { key: "accuracy", label: "Accuracy" },
        { key: "fluency", label: "Fluency" },
        { key: "engagement", label: "Engagement" },
        { key: "last_active", label: "Last Active" },
      ],
      "progress",
      { level: levelFilter },
    );
    toast.success("Progress CSV exported");
  }

  return (
    <AdminLayout title="Progress / Engagement" subtitle="Per-student learning health">
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Engagement ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Student name..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs w-48" />
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
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCsv}>
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No progress data" description="No student progress records." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono-label">Student</TableHead>
                  <TableHead className="font-mono-label">Grade</TableHead>
                  <TableHead className="font-mono-label">Level</TableHead>
                  <TableHead className="font-mono-label">Day Progress</TableHead>
                  <TableHead className="font-mono-label">XP</TableHead>
                  <TableHead className="font-mono-label">Streak</TableHead>
                  <TableHead className="font-mono-label">Confidence</TableHead>
                  <TableHead className="font-mono-label">Accuracy</TableHead>
                  <TableHead className="font-mono-label">Last Active</TableHead>
                  <TableHead className="font-mono-label">Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.user_id}>
                    <TableCell className="text-xs font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs">{r.grade}</TableCell>
                    <TableCell className="text-xs capitalize">{r.level}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={Math.min(r.current_day / 180 * 100, 100)} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-mono w-14 text-right">{r.completed_days}/{r.current_day || 180}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.xp.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{r.streak}🔥</TableCell>
                    <TableCell className="text-xs">{r.confidence}%</TableCell>
                    <TableCell className="text-xs">{r.accuracy}%</TableCell>
                    <TableCell className="text-xs">{r.last_active ? new Date(r.last_active).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{r.weak ? <Badge variant="destructive" className="text-[9px]">Weak</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
