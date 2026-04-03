import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState } from "@/components/admin/EmptyState";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Users, TrendingUp, AlertTriangle, Activity, Target, Shield, Zap, BarChart3 } from "lucide-react";

export default function FounderHQPage() {
  const { data: students, isLoading } = useQuery({
    queryKey: ["fhq-student-count"],
    queryFn: async () => {
      const { count } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: parents } = useQuery({
    queryKey: ["fhq-parent-count"],
    queryFn: async () => {
      const { count } = await supabase.from("parent_profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: paidUsers } = useQuery({
    queryKey: ["fhq-paid-count"],
    queryFn: async () => {
      const { count } = await supabase.from("user_entitlements").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: totalRevenue } = useQuery({
    queryKey: ["fhq-total-revenue"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("amount").eq("status", "captured");
      return data?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) ?? 0;
    },
  });

  const { data: failedTx } = useQuery({
    queryKey: ["fhq-failed-tx"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("amount").eq("status", "failed");
      return { count: data?.length ?? 0, value: data?.reduce((s, t) => s + (Number(t.amount) || 0), 0) ?? 0 };
    },
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["fhq-recent-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const { data: progressStats } = useQuery({
    queryKey: ["fhq-progress-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("student_progress").select("confidence_score, engagement_score");
      if (!data || data.length === 0) return { avgConf: 0, avgEng: 0, atRisk: 0 };
      const avgConf = Math.round(data.reduce((s, r) => s + (Number(r.confidence_score) || 0), 0) / data.length);
      const avgEng = Math.round(data.reduce((s, r) => s + (Number(r.engagement_score) || 0), 0) / data.length);
      const atRisk = data.filter(r => (Number(r.confidence_score) || 0) < 30).length;
      return { avgConf, avgEng, atRisk };
    },
  });

  const conversion = students && students > 0 ? ((paidUsers ?? 0) / students * 100).toFixed(1) : "0";
  const arpu = paidUsers && paidUsers > 0 ? Math.round((totalRevenue ?? 0) / paidUsers) : 0;
  const growthIndex = Number(conversion) > 20 ? "Growing" : Number(conversion) > 5 ? "Active" : "Stagnant";
  const growthColor = growthIndex === "Growing" ? "text-pixo-green" : growthIndex === "Active" ? "text-pixo-amber" : "text-pixo-red";

  if (isLoading) return <AdminLayout title="Founder HQ"><LoadingSpinner /></AdminLayout>;

  return (
    <AdminLayout title="Founder HQ" subtitle="Confidential business truth & revenue intelligence">
      <div className="space-y-6 animate-fade-in">
        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Revenue LTD" value={`₹${(totalRevenue ?? 0).toLocaleString()}`} change="Lifetime to date" changeType="positive" icon={DollarSign} mono />
          <MetricCard title="ARPU" value={`₹${arpu.toLocaleString()}`} change="Avg revenue per user" changeType="neutral" icon={Target} mono />
          <MetricCard title="Conversion Rate" value={`${conversion}%`} change="Free → Paid" changeType={Number(conversion) > 10 ? "positive" : "neutral"} icon={TrendingUp} />
          <MetricCard title="Growth Index" value={growthIndex} change={`${students ?? 0} students, ${paidUsers ?? 0} paid`} changeType={growthIndex === "Growing" ? "positive" : "neutral"} icon={BarChart3} />
        </div>

        {/* Founder Action Alerts (dark panel) */}
        <div className="pixo-dark-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-pixo-amber" />
              <h3 className="text-sm font-semibold text-sidebar-foreground">Founder Action Alerts</h3>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground">
              Full Audit Log
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status="at_risk" />
                <span className="text-xs text-sidebar-foreground/70">Students</span>
              </div>
              <p className="text-xl font-bold text-sidebar-foreground">{progressStats?.atRisk ?? 0}</p>
              <p className="text-[10px] text-sidebar-foreground/50">Below confidence threshold</p>
            </div>
            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status="failed" />
                <span className="text-xs text-sidebar-foreground/70">Failed Txns</span>
              </div>
              <p className="text-xl font-bold text-sidebar-foreground">{failedTx?.count ?? 0}</p>
              <p className="text-[10px] text-sidebar-foreground/50">₹{(failedTx?.value ?? 0).toLocaleString()} recoverable</p>
            </div>
            <div className="rounded-lg bg-sidebar-accent/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status="pending" />
                <span className="text-xs text-sidebar-foreground/70">Churn Signals</span>
              </div>
              <p className="text-xl font-bold text-sidebar-foreground">—</p>
              <p className="text-[10px] text-sidebar-foreground/50">Tracking engagement drop-off</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Forecast */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                90-Day Revenue Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 mb-4">
                <div>
                  <p className="font-mono-label text-muted-foreground">Forecasted Revenue</p>
                  <p className="text-2xl font-bold mt-1">₹{((totalRevenue ?? 0) * 3.2).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="text-pixo-amber border-pixo-amber/30 text-xs">Confidence: Medium</Badge>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="font-mono-label text-muted-foreground">Total Capture</p>
                  <p className="text-lg font-bold mt-1">₹{(totalRevenue ?? 0).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="font-mono-label text-muted-foreground">Conversion</p>
                  <p className="text-lg font-bold mt-1">{conversion}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="font-mono-label text-muted-foreground">ARPU Target</p>
                  <p className="text-lg font-bold mt-1">₹{(arpu * 1.2).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="font-mono-label text-muted-foreground">Growth</p>
                  <p className={`text-lg font-bold mt-1 ${growthColor}`}>{growthIndex}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Audit / Intel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-pixo-green" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!recentAudit || recentAudit.length === 0) ? (
                <EmptyState icon={Shield} title="All clear" description="No recent admin actions recorded" />
              ) : (
                recentAudit.map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-muted/50 text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className="font-mono-label text-[8px]">{log.action_type}</Badge>
                      <span className="text-muted-foreground">{log.module_key}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strategic IQ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Command Directives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg border border-pixo-red/15 bg-pixo-red/[0.02]">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status="critical" />
                  <span className="text-xs font-medium">Revenue Optimization</span>
                </div>
                <p className="text-xs text-muted-foreground">Review conversion funnel for Level 1 → Level 2 drop-off. Current conversion is at {conversion}%.</p>
                <p className="text-[10px] text-pixo-red/70 mt-1 italic">Cost of Inaction: potential ₹{Math.round((totalRevenue ?? 0) * 0.15).toLocaleString()} revenue loss</p>
                <Button variant="outline" size="sm" className="mt-2 h-6 text-[10px]">Execute Protocol</Button>
              </div>
              <div className="p-3 rounded-lg border border-pixo-blue/15 bg-pixo-blue/[0.02]">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono-label text-[9px] text-pixo-blue border-pixo-blue/20">STRATEGIC</Badge>
                  <span className="text-xs font-medium">Engagement Focus</span>
                </div>
                <p className="text-xs text-muted-foreground">Target students with 3+ day streaks for premium conversion campaigns.</p>
                <Button variant="outline" size="sm" className="mt-2 h-6 text-[10px]">Execute Protocol</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-pixo-green" />
                Learning → Revenue Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Engagement Drop-Off</p>
                  <p className="text-[10px] text-muted-foreground">Students below engagement threshold</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{progressStats?.atRisk ?? 0}</p>
                  <StatusBadge status={progressStats?.atRisk && progressStats.atRisk > 5 ? "critical" : "on_track"} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Payment Failures</p>
                  <p className="text-[10px] text-muted-foreground">Recoverable revenue at risk</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{failedTx?.count ?? 0}</p>
                  <StatusBadge status={failedTx?.count && failedTx.count > 0 ? "at_risk" : "on_track"} />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium">Confidence → Retention</p>
                  <p className="text-[10px] text-muted-foreground">Avg confidence: {progressStats?.avgConf ?? 0}%</p>
                </div>
                <StatusBadge status={progressStats?.avgConf && progressStats.avgConf >= 50 ? "on_track" : "at_risk"} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
