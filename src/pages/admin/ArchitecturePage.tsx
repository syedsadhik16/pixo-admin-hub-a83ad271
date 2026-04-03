import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, Activity, CheckCircle, Database, Link2, Shield } from "lucide-react";
import { useState, useEffect } from "react";

const ENVIRONMENTS = [
  { name: "Development", key: "dev", color: "text-muted-foreground border-muted" },
  { name: "Staging", key: "staging", color: "text-pixo-amber border-pixo-amber/30" },
  { name: "Live / Production", key: "live", color: "text-pixo-green border-pixo-green/30" },
];

const API_ENDPOINTS = [
  { name: "CHILD-API", uptime: 99.9 },
  { name: "PARENT-SYNC", uptime: 99.9 },
  { name: "AI-CORE", uptime: 99.9 },
];

export default function ArchitecturePage() {
  const [activeEnv, setActiveEnv] = useState("staging");
  const [, setTick] = useState(0);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: versions } = useQuery({
    queryKey: ["admin-versions"],
    queryFn: async () => {
      const { data } = await supabase.from("app_versions").select("*").order("deployed_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: syncLogs } = useQuery({
    queryKey: ["admin-sync-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("system_sync_logs").select("*").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const allHealthy = API_ENDPOINTS.every(e => e.uptime >= 99);

  return (
    <AdminLayout title="System Architecture" subtitle="Release control & environment monitoring">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ENVIRONMENTS.map(env => (
            <Card key={env.key} className={`cursor-pointer transition-all ${activeEnv === env.key ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setActiveEnv(env.key)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">{env.name}</h3>
                  </div>
                  {activeEnv === env.key && <CheckCircle className="h-4 w-4 text-pixo-green" />}
                </div>
                <Badge variant="outline" className={`text-[10px] ${env.color}`}>
                  {env.key.toUpperCase()}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-pixo-green" />Version History</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs">View All Backups</Button>
              </div>
            </CardHeader>
            <CardContent>
              {!versions?.length ? (
                <EmptyState icon={Server} title="No version records yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono-label">Version</TableHead>
                      <TableHead className="font-mono-label">Env</TableHead>
                      <TableHead className="font-mono-label">Deployed</TableHead>
                      <TableHead className="font-mono-label">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-mono">{v.version_name}</TableCell>
                        <TableCell className="text-xs">{v.environment}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(v.deployed_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${v.is_active ? "text-pixo-green border-pixo-green/30" : "text-muted-foreground"}`}>
                            {v.is_active ? "STABLE" : "ARCHIVED"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                API Endpoint Status
                <Badge className={`text-[9px] border-0 ml-auto ${allHealthy ? "bg-pixo-green/10 text-pixo-green" : "bg-pixo-red/10 text-pixo-red"}`}>
                  {allHealthy ? "ALL SYSTEMS GO" : "DEGRADED"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {API_ENDPOINTS.map(ep => (
                <div key={ep.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-pixo-green" />
                    <span className="text-xs font-mono font-medium">{ep.name}</span>
                  </div>
                  <span className="text-xs font-mono text-pixo-green">{ep.uptime}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Data Mirroring */}
          <div className="rounded-xl bg-primary p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-primary-foreground" />
              <h3 className="text-sm font-semibold text-primary-foreground">Data Mirroring</h3>
            </div>
            <p className="text-xs text-primary-foreground/70 mb-3">Multi-region data replication cluster active</p>
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" className="text-xs gap-1"><Link2 className="h-3 w-3" />Manage Data Nodes</Button>
              <Badge variant="outline" className="text-[10px] border-primary-foreground/30 text-primary-foreground">3 nodes</Badge>
            </div>
          </div>

          {/* Sync Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-pixo-blue" />Sync Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {!syncLogs?.length ? (
                <EmptyState icon={Activity} title="No sync events recorded" />
              ) : (
                <div className="space-y-2">
                  {syncLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{log.sync_type}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${log.status === "success" ? "text-pixo-green border-pixo-green/30" : "text-pixo-red border-pixo-red/30"}`}>
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
