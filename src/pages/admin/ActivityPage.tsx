import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Activity, Search, Download, Smartphone, Monitor, Globe } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

interface LoginRow {
  id: string;
  user_id: string;
  name: string;
  user_type: string;
  logged_in_at: string;
  device_type: string;
  platform: string;
  browser: string;
  app_source: string;
}

export default function ActivityPage() {
  const [search, setSearch] = useState("");

  const { data: logins, isLoading } = useQuery({
    queryKey: ["admin-activity-logins"],
    queryFn: async (): Promise<LoginRow[]> => {
      const [logRes, profRes] = await Promise.all([
        supabase.from("user_login_events").select("*").order("logged_in_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, full_name, user_type"),
      ]);
      const profMap = new Map(((profRes as any).data ?? []).map((p: any) => [p.id, p]));
      return (((logRes as any).data ?? []) as any[]).map(l => {
        const p = profMap.get(l.user_id) as any;
        return {
          id: l.id,
          user_id: l.user_id,
          name: p?.full_name ?? l.user_id.slice(0, 8),
          user_type: p?.user_type ?? "unknown",
          logged_in_at: l.logged_in_at,
          device_type: l.device_type ?? "—",
          platform: l.platform ?? "—",
          browser: l.browser ?? "—",
          app_source: l.app_source ?? "—",
        };
      });
    },
  });

  const filtered = useMemo(() => (logins ?? []).filter(r => {
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase());
  }), [logins, search]);

  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = (logins ?? []).filter(l => new Date(l.logged_in_at) >= todayStart).length;
    const uniqueUsers = new Set((logins ?? []).map(l => l.user_id)).size;
    return { today, uniqueUsers, total: logins?.length ?? 0 };
  }, [logins]);

  const breakdowns = useMemo(() => {
    const tally = (key: keyof LoginRow) => {
      const map = new Map<string, number>();
      (logins ?? []).forEach(l => {
        const v = String(l[key] ?? "—");
        map.set(v, (map.get(v) ?? 0) + 1);
      });
      return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    };
    return {
      device: tally("device_type"),
      platform: tally("platform"),
      browser: tally("browser"),
      app: tally("app_source"),
    };
  }, [logins]);

  async function exportCsv() {
    await exportAndDownload(
      `pixo-activity-${new Date().toISOString().slice(0, 10)}`,
      filtered,
      [
        { key: "name", label: "User" },
        { key: "user_type", label: "Type" },
        { key: "logged_in_at", label: "Logged In" },
        { key: "device_type", label: "Device" },
        { key: "platform", label: "Platform" },
        { key: "browser", label: "Browser" },
        { key: "app_source", label: "App Source" },
      ],
      "activity_logins",
    );
    toast.success("Activity CSV exported");
  }

  return (
    <AdminLayout title="Login & Activity" subtitle="Real-time session tracking">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Today's Logins</p><p className="text-3xl font-bold mt-1">{stats.today}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Unique Users</p><p className="text-3xl font-bold mt-1">{stats.uniqueUsers}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="font-mono-label text-muted-foreground">Total Logins (500 max)</p><p className="text-3xl font-bold mt-1">{stats.total}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="recent" className="w-full">
          <TabsList>
            <TabsTrigger value="recent">Recent Logins</TabsTrigger>
            <TabsTrigger value="attendance">Attendance & Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Logins</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="User name..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs w-48" />
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCsv}>
                      <Download className="h-3 w-3" /> Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No login events yet"
                    description="The user_login_events table is ready. Once the student & parent apps post login events here, this view will populate live."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">User</TableHead>
                        <TableHead className="font-mono-label">Type</TableHead>
                        <TableHead className="font-mono-label">Logged In</TableHead>
                        <TableHead className="font-mono-label">Device</TableHead>
                        <TableHead className="font-mono-label">Platform</TableHead>
                        <TableHead className="font-mono-label">Browser</TableHead>
                        <TableHead className="font-mono-label">App</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs font-medium">{r.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] capitalize">{r.user_type}</Badge></TableCell>
                          <TableCell className="text-xs">{new Date(r.logged_in_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{r.device_type}</TableCell>
                          <TableCell className="text-xs">{r.platform}</TableCell>
                          <TableCell className="text-xs">{r.browser}</TableCell>
                          <TableCell className="text-xs">{r.app_source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            {isLoading ? <LoadingSpinner /> : (logins ?? []).length === 0 ? (
              <EmptyState icon={Activity} title="No data yet" description="Device & browser breakdowns will appear once login events arrive." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BreakdownCard title="Device Types" icon={Smartphone} rows={breakdowns.device} total={stats.total} />
                <BreakdownCard title="Platforms" icon={Monitor} rows={breakdowns.platform} total={stats.total} />
                <BreakdownCard title="Browsers" icon={Globe} rows={breakdowns.browser} total={stats.total} />
                <BreakdownCard title="App Sources" icon={Activity} rows={breakdowns.app} total={stats.total} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function BreakdownCard({ title, icon: Icon, rows, total }: { title: string; icon: any; rows: [string, number][]; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
        {rows.map(([label, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium capitalize">{label}</span>
                <span className="text-muted-foreground">{count} · {pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
