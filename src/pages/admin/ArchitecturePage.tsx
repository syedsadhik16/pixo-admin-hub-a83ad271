import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, Activity, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const environments = [
  { name: "Development", key: "dev", status: "active" },
  { name: "Staging", key: "staging", status: "inactive" },
  { name: "Live / Production", key: "live", status: "active" },
];

export default function ArchitecturePage() {
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

  return (
    <AdminLayout title="System Architecture" subtitle="Release control & environment monitoring">
      <div className="space-y-6">
        {/* Environment Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {environments.map(env => (
            <Card key={env.key}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">{env.name}</h3>
                  </div>
                  <Badge className={`text-[10px] border-0 ${env.status === "active" ? "bg-pixo-green/10 text-pixo-green" : "bg-muted text-muted-foreground"}`}>
                    {env.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    <span>Status: {env.status === "active" ? "Healthy" : "Not deployed"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Last deploy: {env.status === "active" ? "Today" : "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-pixo-green" />Version History</CardTitle>
            </CardHeader>
            <CardContent>
              {!versions || versions.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No version records yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Version</TableHead>
                      <TableHead className="text-xs">Environment</TableHead>
                      <TableHead className="text-xs">Deployed</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-mono">{v.version_name}</TableCell>
                        <TableCell className="text-xs">{v.environment}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(v.deployed_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] border-0 ${v.is_active ? "bg-pixo-green/10 text-pixo-green" : "bg-muted text-muted-foreground"}`}>
                            {v.is_active ? "Active" : "Archived"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Sync Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-pixo-blue" />Sync Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {!syncLogs || syncLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No sync events recorded</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {syncLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg bg-pixo-surface flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{log.sync_type}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                      </div>
                      <Badge className={`text-[10px] border-0 ${log.status === "success" ? "bg-pixo-green/10 text-pixo-green" : "bg-pixo-red/10 text-pixo-red"}`}>
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
