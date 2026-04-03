import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Activity, AlertTriangle, Search, Eye } from "lucide-react";
import { useState } from "react";

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

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

  const { data: studentRegistry, isLoading } = useQuery({
    queryKey: ["dash-student-registry"],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_profiles")
        .select(`
          *,
          profiles:user_id(full_name, email),
          student_progress:student_progress(*)
        `)
        .limit(50);
      return data ?? [];
    },
  });

  const conversion = totalStudents && totalStudents > 0 ? ((paidUsers ?? 0) / totalStudents * 100).toFixed(1) : "0";

  const filteredRegistry = (studentRegistry ?? []).filter((s: any) => {
    const name = s.profiles?.full_name?.toLowerCase() ?? "";
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === "all" || s.current_level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <AdminLayout title="Signal Dashboard" subtitle="Real-time constraint monitoring">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Registered Students" value={totalStudents ?? 0} change="+14%" changeType="positive" icon={Users} />
          <MetricCard title="Paid Users" value={paidUsers ?? 0} change={`${conversion}% conversion`} changeType="neutral" icon={TrendingUp} />
          <MetricCard title="Avg Confidence" value="72%" change="+8% this week" changeType="positive" icon={Activity} />
          <MetricCard title="Active Today" value="--" change="Real-time" changeType="neutral" icon={Activity} />
        </div>

        {/* Critical Flags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-pixo-amber" />
              Critical Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-pixo-red/20 bg-pixo-red/5">
                <p className="text-xs font-medium text-pixo-red">Revenue Leakage</p>
                <p className="text-xs text-muted-foreground mt-1">Monitor payment failures and abandoned checkouts</p>
              </div>
              <div className="p-3 rounded-lg border border-pixo-amber/20 bg-pixo-amber/5">
                <p className="text-xs font-medium text-pixo-amber">At-Risk Students</p>
                <p className="text-xs text-muted-foreground mt-1">Students with declining engagement scores</p>
              </div>
              <div className="p-3 rounded-lg border border-pixo-blue/20 bg-pixo-blue/5">
                <p className="text-xs font-medium text-pixo-blue">Inbound Velocity</p>
                <p className="text-xs text-muted-foreground mt-1">New registration trends and conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Registry */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Student Registry</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search students..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 pl-8 text-xs w-48" />
                </div>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
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
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredRegistry.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No students found</p>
                <p className="text-xs text-muted-foreground">Students will appear here when they sign up</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Student</TableHead>
                    <TableHead className="text-xs">Level</TableHead>
                    <TableHead className="text-xs">Grade</TableHead>
                    <TableHead className="text-xs">Progress</TableHead>
                    <TableHead className="text-xs">Confidence</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistry.map((student: any) => {
                    const progress = Array.isArray(student.student_progress) ? student.student_progress[0] : null;
                    const confidence = progress?.confidence_score ?? 0;
                    const status = confidence >= 60 ? "ON TRACK" : confidence >= 30 ? "NEEDS SUPPORT" : "AT RISK";
                    const statusColor = confidence >= 60 ? "text-pixo-green" : confidence >= 30 ? "text-pixo-amber" : "text-pixo-red";
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="text-xs font-medium">{student.profiles?.full_name || "—"}</TableCell>
                        <TableCell className="text-xs">{student.current_level || "—"}</TableCell>
                        <TableCell className="text-xs">{student.grade || "—"}</TableCell>
                        <TableCell className="text-xs">Day {progress?.current_day ?? 0}</TableCell>
                        <TableCell className="text-xs">{confidence}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>{status}</Badge>
                        </TableCell>
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
