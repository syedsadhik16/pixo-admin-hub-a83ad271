// Admin Leads & Login Tracking page.
// Shows: login attempts, payment funnel, hot leads, failed payments, pipeline summary.
// All data is live from public.lead_events, payment_funnel_events, lead_pipeline.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Target, Filter, XCircle, Flame, Search, Download, LogIn } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

type FunnelEventType = "page_view" | "initiated" | "success" | "failed";

function funnelColor(t: FunnelEventType | string) {
  switch (t) {
    case "success":   return "bg-pixo-green/15 text-pixo-green border-pixo-green/30";
    case "failed":    return "bg-pixo-red/15 text-pixo-red border-pixo-red/30";
    case "initiated": return "bg-pixo-amber/15 text-pixo-amber border-pixo-amber/30";
    case "page_view": return "bg-pixo-blue/15 text-pixo-blue border-pixo-blue/30";
    default:          return "bg-muted text-muted-foreground";
  }
}

function stageColor(s: string) {
  switch (s) {
    case "converted": return "bg-pixo-green/15 text-pixo-green border-pixo-green/30";
    case "hot":       return "bg-pixo-red/15 text-pixo-red border-pixo-red/30";
    case "warm":      return "bg-pixo-amber/15 text-pixo-amber border-pixo-amber/30";
    case "cold":      return "bg-pixo-blue/15 text-pixo-blue border-pixo-blue/30";
    case "dropped":   return "bg-muted text-muted-foreground border-border";
    default:          return "bg-muted text-muted-foreground";
  }
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");

  // ---- Login attempts ----
  const { data: loginEvents, isLoading: loadingLogins } = useQuery({
    queryKey: ["admin-login-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_events")
        .select("*")
        .in("event_type", ["login_attempt", "login_success", "login_failed"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Payment funnel ----
  const { data: funnelEvents, isLoading: loadingFunnel } = useQuery({
    queryKey: ["admin-payment-funnel-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_funnel_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Pipeline ----
  const { data: pipeline, isLoading: loadingPipeline } = useQuery({
    queryKey: ["admin-lead-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_pipeline")
        .select("*")
        .order("last_activity_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Profiles map for joining names/emails ----
  const userIds = useMemo(() => {
    const set = new Set<string>();
    (pipeline ?? []).forEach(p => p.user_id && set.add(p.user_id));
    (funnelEvents ?? []).forEach(f => f.user_id && set.add(f.user_id));
    (loginEvents ?? []).forEach(l => l.user_id && set.add(l.user_id));
    return Array.from(set);
  }, [pipeline, funnelEvents, loginEvents]);

  const { data: profilesMap } = useQuery({
    queryKey: ["admin-leads-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);
      const map = new Map<string, { full_name: string | null; email: string | null; phone: string | null }>();
      (data ?? []).forEach(p => map.set(p.id, { full_name: p.full_name, email: p.email, phone: p.phone }));
      return map;
    },
  });

  // ---- Counts ----
  const loginCounts = useMemo(() => {
    const c = { total: 0, success: 0, failed: 0, attempt: 0 };
    (loginEvents ?? []).forEach(e => {
      c.total++;
      if (e.event_type === "login_success") c.success++;
      else if (e.event_type === "login_failed") c.failed++;
      else c.attempt++;
    });
    return c;
  }, [loginEvents]);

  const funnelCounts = useMemo(() => {
    const c = { page_view: 0, initiated: 0, success: 0, failed: 0 };
    (funnelEvents ?? []).forEach(e => {
      const t = e.event_type as FunnelEventType;
      if (t in c) c[t]++;
    });
    return c;
  }, [funnelEvents]);

  const pipelineCounts = useMemo(() => {
    const c: Record<string, number> = { cold: 0, warm: 0, hot: 0, converted: 0, dropped: 0 };
    (pipeline ?? []).forEach(p => { c[p.stage] = (c[p.stage] ?? 0) + 1; });
    return c;
  }, [pipeline]);

  const hotLeads = useMemo(() => (pipeline ?? []).filter(p => p.stage === "hot"), [pipeline]);
  const failedPayments = useMemo(() => (funnelEvents ?? []).filter(e => e.event_type === "failed"), [funnelEvents]);

  // ---- Search filter (apply to logins) ----
  const filteredLogins = useMemo(() => {
    if (!search) return loginEvents ?? [];
    const t = search.toLowerCase();
    return (loginEvents ?? []).filter(l =>
      (l.email ?? "").toLowerCase().includes(t) ||
      (l.failure_reason ?? "").toLowerCase().includes(t),
    );
  }, [loginEvents, search]);

  function nameFor(uid: string | null) {
    if (!uid) return "—";
    return profilesMap?.get(uid)?.full_name ?? uid.slice(0, 8);
  }
  function emailFor(uid: string | null, fallback?: string | null) {
    if (uid && profilesMap?.get(uid)?.email) return profilesMap!.get(uid)!.email;
    return fallback ?? "—";
  }
  function phoneFor(uid: string | null) {
    if (!uid) return "—";
    return profilesMap?.get(uid)?.phone ?? "—";
  }

  async function exportLogins() {
    await exportAndDownload(
      `pixo-login-attempts-${new Date().toISOString().slice(0, 10)}`,
      filteredLogins,
      [
        { key: "created_at", label: "Timestamp" },
        { key: "event_type", label: "Event" },
        { key: "email", label: "Email" },
        { key: "role_attempted", label: "Role" },
        { key: "success", label: "Success" },
        { key: "failure_reason", label: "Failure Reason" },
        { key: "route", label: "Route" },
        { key: "browser", label: "Browser" },
        { key: "device_type", label: "Device" },
      ],
      "login_attempts",
    );
    toast.success("Login attempts CSV exported");
  }

  async function exportFunnel() {
    await exportAndDownload(
      `pixo-payment-funnel-${new Date().toISOString().slice(0, 10)}`,
      funnelEvents ?? [],
      [
        { key: "created_at", label: "Timestamp" },
        { key: "event_type", label: "Stage" },
        { key: "user_id", label: "User ID" },
        { key: "plan_name", label: "Plan" },
        { key: "amount", label: "Amount" },
        { key: "failure_reason", label: "Failure Reason" },
      ],
      "payment_funnel_events",
    );
    toast.success("Funnel CSV exported");
  }

  return (
    <AdminLayout title="Leads & Login Tracking" subtitle="Login attempts, payment intents and lead pipeline — all live">
      <div className="space-y-6 animate-fade-in">
        {/* Pipeline summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard title="Cold" value={pipelineCounts.cold} change="Signup only" changeType="neutral" icon={Target} />
          <MetricCard title="Warm" value={pipelineCounts.warm} change="Login attempted" changeType="neutral" icon={LogIn} />
          <MetricCard title="Hot" value={pipelineCounts.hot} change="Payment intent" changeType="negative" icon={Flame} />
          <MetricCard title="Converted" value={pipelineCounts.converted} change="Paid" changeType="positive" icon={Activity} />
          <MetricCard title="Dropped" value={pipelineCounts.dropped} change="Abandoned" changeType="neutral" icon={XCircle} />
        </div>

        <Tabs defaultValue="logins" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logins">Login Attempts</TabsTrigger>
            <TabsTrigger value="funnel">Payment Funnel</TabsTrigger>
            <TabsTrigger value="hot">Hot Leads</TabsTrigger>
            <TabsTrigger value="failed">Failed Payments</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>

          {/* Login Attempts */}
          <TabsContent value="logins" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Total" value={loginCounts.total} change="All attempts" changeType="neutral" icon={Activity} />
              <MetricCard title="Successful" value={loginCounts.success} change="Authenticated" changeType="positive" icon={LogIn} />
              <MetricCard title="Failed" value={loginCounts.failed} change="Investigate" changeType="negative" icon={XCircle} />
              <MetricCard title="Attempts" value={loginCounts.attempt} change="Pre-auth" changeType="neutral" icon={Target} />
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LogIn className="h-4 w-4" /> Recent Login Attempts ({filteredLogins.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search email / reason..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-8 pl-8 text-xs w-56"
                      />
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportLogins}>
                      <Download className="h-3 w-3" /> Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLogins ? <LoadingSpinner /> : filteredLogins.length === 0 ? (
                  <EmptyState icon={LogIn} title="No login attempts yet" description="Login attempts will appear here once users try to sign in." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">When</TableHead>
                        <TableHead className="font-mono-label">Email</TableHead>
                        <TableHead className="font-mono-label">Role</TableHead>
                        <TableHead className="font-mono-label">Event</TableHead>
                        <TableHead className="font-mono-label">Reason</TableHead>
                        <TableHead className="font-mono-label">Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogins.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium">{l.email ?? "—"}</TableCell>
                          <TableCell className="text-xs">{l.role_attempted ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              l.event_type === "login_success" ? "bg-pixo-green/15 text-pixo-green border-pixo-green/30"
                              : l.event_type === "login_failed" ? "bg-pixo-red/15 text-pixo-red border-pixo-red/30"
                              : "bg-pixo-blue/15 text-pixo-blue border-pixo-blue/30"
                            }>
                              {l.event_type.replace("login_", "")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-pixo-red">{l.failure_reason ?? "—"}</TableCell>
                          <TableCell className="text-xs">{l.browser ?? "—"} · {l.device_type ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Funnel */}
          <TabsContent value="funnel" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard title="Page Views" value={funnelCounts.page_view} change="Visited payment" changeType="neutral" icon={Filter} />
              <MetricCard title="Initiated" value={funnelCounts.initiated} change="Started checkout" changeType="neutral" icon={Activity} />
              <MetricCard title="Successful" value={funnelCounts.success} change="Captured" changeType="positive" icon={Activity} />
              <MetricCard title="Failed" value={funnelCounts.failed} change="Recoverable" changeType="negative" icon={XCircle} />
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Payment Funnel Events ({(funnelEvents ?? []).length})
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportFunnel}>
                    <Download className="h-3 w-3" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? <LoadingSpinner /> : (funnelEvents ?? []).length === 0 ? (
                  <EmptyState icon={Filter} title="No payment events yet" description="Payment intent events will appear here as users move through checkout." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">When</TableHead>
                        <TableHead className="font-mono-label">User</TableHead>
                        <TableHead className="font-mono-label">Stage</TableHead>
                        <TableHead className="font-mono-label">Plan / Amount</TableHead>
                        <TableHead className="font-mono-label">Failure</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(funnelEvents ?? []).map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs">{new Date(f.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{nameFor(f.user_id)}</div>
                            <div className="text-muted-foreground text-[10px]">{emailFor(f.user_id)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize ${funnelColor(f.event_type)}`}>
                              {f.event_type.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{f.plan_name ?? "—"}</div>
                            {f.amount ? <div className="text-muted-foreground text-[10px]">₹{Number(f.amount).toLocaleString()}</div> : null}
                          </TableCell>
                          <TableCell className="text-xs text-pixo-red">{f.failure_reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hot Leads */}
          <TabsContent value="hot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="h-4 w-4 text-pixo-red" /> Hot Leads ({hotLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPipeline ? <LoadingSpinner /> : hotLeads.length === 0 ? (
                  <EmptyState icon={Flame} title="No hot leads yet" description="Users who reach the payment page or initiate payment will show here." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">User</TableHead>
                        <TableHead className="font-mono-label">Phone</TableHead>
                        <TableHead className="font-mono-label">Last Activity</TableHead>
                        <TableHead className="font-mono-label">Payment Page</TableHead>
                        <TableHead className="font-mono-label">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hotLeads.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium">{nameFor(p.user_id)}</div>
                            <div className="text-muted-foreground text-[10px]">{emailFor(p.user_id)}</div>
                          </TableCell>
                          <TableCell className="text-xs">{phoneFor(p.user_id)}</TableCell>
                          <TableCell className="text-xs">{p.last_activity_at ? new Date(p.last_activity_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-xs">{p.payment_page_visited ? "Yes" : "No"}</TableCell>
                          <TableCell className="text-xs">{p.remarks ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failed Payments */}
          <TabsContent value="failed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-pixo-red" /> Failed Payments ({failedPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? <LoadingSpinner /> : failedPayments.length === 0 ? (
                  <EmptyState icon={XCircle} title="No failed payments" description="When checkouts fail, the recoverable revenue will appear here." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">When</TableHead>
                        <TableHead className="font-mono-label">User</TableHead>
                        <TableHead className="font-mono-label">Plan / Amount</TableHead>
                        <TableHead className="font-mono-label">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedPayments.map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="text-xs">{new Date(f.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{nameFor(f.user_id)}</div>
                            <div className="text-muted-foreground text-[10px]">{emailFor(f.user_id)}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{f.plan_name ?? "—"}</div>
                            {f.amount ? <div className="text-muted-foreground text-[10px]">₹{Number(f.amount).toLocaleString()}</div> : null}
                          </TableCell>
                          <TableCell className="text-xs text-pixo-red">{f.failure_reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline */}
          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" /> Lead Pipeline ({(pipeline ?? []).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPipeline ? <LoadingSpinner /> : (pipeline ?? []).length === 0 ? (
                  <EmptyState icon={Target} title="No pipeline records" description="Leads will be auto-classified once login or payment events arrive." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono-label">User</TableHead>
                        <TableHead className="font-mono-label">Stage</TableHead>
                        <TableHead className="font-mono-label">Last Activity</TableHead>
                        <TableHead className="font-mono-label">Next Follow-up</TableHead>
                        <TableHead className="font-mono-label">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(pipeline ?? []).map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">
                            <div className="font-medium">{nameFor(p.user_id)}</div>
                            <div className="text-muted-foreground text-[10px]">{emailFor(p.user_id)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize ${stageColor(p.stage)}`}>{p.stage}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{p.last_activity_at ? new Date(p.last_activity_at).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-xs">{p.next_follow_up_at ? new Date(p.next_follow_up_at).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="text-xs">{p.remarks ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
