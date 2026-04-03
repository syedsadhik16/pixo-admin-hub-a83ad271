import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { LiveIndicator } from "@/components/admin/LiveIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Activity, AlertTriangle, Search, Eye, Zap } from "lucide-react";
import { useState } from "react";
import { useRealtimeChannel } from "@/hooks/useRealtimeChannel";

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const channelStatus = useRealtimeChannel("dashboard-stats", [
    {
      table: "student_profiles",
      event: "INSERT",
      callback: () => {
        queryClient.invalidateQueries({ queryKey: ["dash-total-students"] });
        queryClient.invalidateQueries({ queryKey: ["dash-level-stats"] });
      },
    },
    {
      table: "user_entitlements",
      event: "*",
      callback: () => {
        queryClient.invalidateQueries({ queryKey: ["dash-paid-users"] });
      },
    },
    {
      table: "student_progress",
      event: "*",
      callback: () => {
        queryClient.invalidateQueries({ queryKey: ["dash-avg-confidence"] });
        queryClient.invalidateQueries({ queryKey: ["dash-student-registry"] });
      },
    },
  ]);

  const { data: totalStudents } = useQuery({
    queryKey: ["dash-total-students"],
    queryFn: async () => {
      const { count } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: paidUsers } = useQuery({
    queryKey: ["dash-paid-users"],
    queryFn: async () => {
      const { count } = await supabase.from("user_entitlements").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: avgConfidence } = useQuery({
    queryKey: ["dash-avg-confidence"],
    queryFn: async () => {
      const { data } = await supabase.from("student_progress").select("confidence_score");
      if (!data || data.length === 0) return null;
      const avg = data.reduce((s, r) => s + (Number(r.confidence_score) || 0), 0) / data.length;
      return Math.round(avg);
    },
  });

  const { data: levelStats } = useQuery({
    queryKey: ["dash-level-stats"],
    queryFn: async () => {
      const { data: students } = await supabase.from("student_profiles").select("current_level, active_plan");
      const { data: progress } = await supabase.from("student_progress").select("current_level, current_day, completed_days");
      if (!students) return [];
      const levels = ["beginner", "intermediate", "advanced"];
      return levels.map(lvl => {
        const inLevel = students.filter(s => s.current_level === lvl);
        const paid = inLevel.filter(s => s.active_plan && s.active_plan !== "free");
        const progressInLevel = (progress ?? []).filter(p => p.current_level === lvl);
        const avgDay = progressInLevel.length > 0
          ? Math.round(progressInLevel.reduce((s, p) => s + (p.current_day ?? 0), 0) / progressInLevel.length)
          : 0;
        return {
          level: lvl,
          total: inLevel.length,
          paid: paid.length,
          conversion: inLevel.length > 0 ? ((paid.length / inLevel.length) * 100).toFixed(1) : "0",
          avgDay,
          dropOff: inLevel.length > 5 ? ((inLevel.length - paid.length) / inLevel.length * 100).toFixed(0) : "—",
        };
      });
    },
  });

  const { data: studentRegistry, isLoading: loadingRegistry } = useQuery({
    queryKey: ["dash-student-registry"],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_profiles")
        .select(`*, profiles:user_id(full_name, email), student_progress:student_progress(*)`)
        .limit(50);
      return data ?? [];
    },
  });

  const conversion = totalStudents && totalStudents > 0 ? ((paidUsers ?? 0) / totalStudents * 100).toFixed(1) : "0";

  const filteredRegistry = (studentRegistry ?? []).filter((s: any) => {
    const name = s.profiles?.full_name?.toLowerCase() ?? "";
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === "all" || s.current_level === levelFilter;
    const matchesPlan = planFilter === "all" || (planFilter === "paid" ? s.active_plan && s.active_plan !== "free" : !s.active_plan || s.active_plan === "free");
    return matchesSearch && matchesLevel && matchesPlan;
  });

  return (
    <AdminLayout title="PIXO Tracking Engine" subtitle="Real-time constraint monitoring & decision intelligence">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <LiveIndicator status={channelStatus} className="absolute top-3 right-3 z-10" />
            <MetricCard title="Registered Apps" value={totalStudents ?? 0} change="Global cohort" changeType="neutral" icon={Users} />
          </div>
          <div className="relative">
            <LiveIndicator status={channelStatus} className="absolute top-3 right-3 z-10" />
            <MetricCard title="Paid Users" value={`${paidUsers ?? 0}`} change={`${conversion}% conversion`} changeType={Number(conversion) > 10 ? "positive" : "neutral"} icon={TrendingUp} />
          </div>
          <div className="relative">
            <LiveIndicator status={channelStatus} className="absolute top-3 right-3 z-10" />
            <MetricCard title="Avg Confidence" value={avgConfidence !== null ? `${avgConfidence}%` : "—"} change={avgConfidence !== null ? "Across active students" : "No data yet"} changeType={avgConfidence && avgConfidence > 60 ? "positive" : "neutral"} icon={Activity} />
          </div>
          <MetricCard title="Active Today" value="—" change="Real-time session tracking" changeType="neutral" icon={Zap} />
        </div>

        <Card className="border-pixo-red/20 bg-pixo-red/[0.02]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-pixo-red" />
              <span>Critical Flags</span>
              <StatusBadge status="critical" className="ml-auto" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-pixo-red/15 bg-card">
                <p className="font-mono-label text-pixo-red mb-1">Revenue Leakage</p>
                <p className="text-xs text-muted-foreground">Monitor payment failures and abandoned checkouts</p>
              </div>
              <div className="p-3 rounded-lg border border-pixo-amber/15 bg-card">
                <p className="font-mono-label text-pixo-amber mb-1">At-Risk Students</p>
                <p className="text-xs text-muted-foreground">Students with declining engagement scores</p>
              </div>
              <div className="p-3 rounded-lg border border-pixo-blue/15 bg-card">
                <p className="font-mono-label text-pixo-blue mb-1">Inbound Velocity</p>
                <p className="text-xs text-muted-foreground">New registration trends and conversion patterns</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Level-Wise Conversion & Retention</CardTitle>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Zap className="h-3 w-3" />
                Decision Readouts
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!levelStats || levelStats.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No level data available" description="Level stats will appear when students are assigned to levels" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Level</TableHead>
                    <TableHead className="font-mono-label">Total</TableHead>
                    <TableHead className="font-mono-label">Paid</TableHead>
                    <TableHead className="font-mono-label">Conversion %</TableHead>
                    <TableHead className="font-mono-label">Avg Day</TableHead>
                    <TableHead className="font-mono-label">Drop-Off %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levelStats.map(row => (
                    <TableRow key={row.level}>
                      <TableCell className="text-xs font-medium capitalize">{row.level}</TableCell>
                      <TableCell className="text-xs">{row.total}</TableCell>
                      <TableCell className="text-xs">{row.paid}</TableCell>
                      <TableCell className="text-xs">{row.conversion}%</TableCell>
                      <TableCell className="text-xs">{row.avgDay}/180</TableCell>
                      <TableCell className="text-xs">{row.dropOff}{row.dropOff !== "—" ? "%" : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">Student Progress Tracking</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs w-44" />
                </div>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRegistry ? (
              <LoadingSpinner />
            ) : filteredRegistry.length === 0 ? (
              <EmptyState icon={Users} title="No students found" description="Students will appear here when they register and begin learning" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono-label">Learner</TableHead>
                    <TableHead className="font-mono-label">Level</TableHead>
                    <TableHead className="font-mono-label">Day Progress</TableHead>
                    <TableHead className="font-mono-label">Confidence</TableHead>
                    <TableHead className="font-mono-label">Health</TableHead>
                    <TableHead className="font-mono-label">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistry.map((student: any) => {
                    const progress = Array.isArray(student.student_progress) ? student.student_progress[0] : null;
                    const confidence = Number(progress?.confidence_score ?? 0);
                    const currentDay = progress?.current_day ?? 0;
                    const dayPct = Math.min((currentDay / 180) * 100, 100);
                    const health: "on_track" | "at_risk" | "critical" =
                      confidence >= 60 ? "on_track" : confidence >= 30 ? "at_risk" : "critical";

                    return (
                      <TableRow key={student.id} className="transition-all duration-300">
                        <TableCell>
                          <div>
                            <p className="text-xs font-medium">{student.profiles?.full_name || "—"}</p>
                            <p className="font-mono-label text-muted-foreground">{student.user_id?.slice(0, 8)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{student.current_level || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={dayPct} className="h-1.5 flex-1 transition-all duration-500" />
                            <span className="text-[10px] text-muted-foreground font-mono w-12 text-right">{currentDay}/180</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{confidence}%</TableCell>
                        <TableCell><StatusBadge status={health} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
