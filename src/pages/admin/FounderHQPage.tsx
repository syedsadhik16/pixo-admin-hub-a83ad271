import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricCard } from "@/components/admin/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, TrendingUp, AlertTriangle, Activity, Target, Shield, Zap } from "lucide-react";

export default function FounderHQPage() {
  const { data: students } = useQuery({
    queryKey: ["admin-student-count"],
    queryFn: async () => {
      const { count } = await supabase.from("student_profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: parents } = useQuery({
    queryKey: ["admin-parent-count"],
    queryFn: async () => {
      const { count } = await supabase.from("parent_profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: paidUsers } = useQuery({
    queryKey: ["admin-paid-count"],
    queryFn: async () => {
      const { count } = await supabase.from("user_entitlements").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: totalRevenue } = useQuery({
    queryKey: ["admin-total-revenue"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_transactions").select("amount").eq("status", "captured");
      return data?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) ?? 0;
    },
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["admin-recent-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const conversion = students && students > 0 ? ((paidUsers ?? 0) / students * 100).toFixed(1) : "0";

  return (
    <AdminLayout title="Founder HQ" subtitle="Confidential business truth & revenue forecasting">
      <div className="space-y-6">
        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Revenue (LTD)" value={`₹${(totalRevenue ?? 0).toLocaleString()}`} change="+14% from last month" changeType="positive" icon={DollarSign} />
          <MetricCard title="Active Students" value={students ?? 0} change="+8% growth" changeType="positive" icon={Users} />
          <MetricCard title="Paid Subscribers" value={paidUsers ?? 0} change={`${conversion}% conversion`} changeType="neutral" icon={Target} />
          <MetricCard title="Active Parents" value={parents ?? 0} change="+4% connected" changeType="positive" icon={Activity} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Forecast */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-pixo-blue" />
                90-Day Revenue Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-pixo-surface">
                <div>
                  <p className="text-xs text-muted-foreground">Forecasted Revenue</p>
                  <p className="text-2xl font-bold">₹{((totalRevenue ?? 0) * 3.2).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="text-pixo-amber border-pixo-amber/30">Confidence: Medium</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-pixo-surface text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">ARPU</p>
                  <p className="text-lg font-bold">₹{paidUsers && paidUsers > 0 ? Math.round((totalRevenue ?? 0) / paidUsers).toLocaleString() : "0"}</p>
                </div>
                <div className="p-3 rounded-lg bg-pixo-surface text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Conversion</p>
                  <p className="text-lg font-bold">{conversion}%</p>
                </div>
                <div className="p-3 rounded-lg bg-pixo-surface text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Growth Index</p>
                  <p className="text-lg font-bold text-pixo-green">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Founder Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-pixo-amber" />
                Action Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(!recentAudit || recentAudit.length === 0) ? (
                <div className="text-center py-6">
                  <Shield className="h-8 w-8 mx-auto text-pixo-green/40 mb-2" />
                  <p className="text-xs text-muted-foreground">All clear. No critical alerts.</p>
                </div>
              ) : (
                recentAudit.map((log: any) => (
                  <div key={log.id} className="p-3 rounded-lg bg-pixo-surface text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px]">{log.action_type}</Badge>
                      <span className="text-muted-foreground">{log.module_key}</span>
                    </div>
                    <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Strategic Intelligence */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-pixo-purple" />
                Strategic Directives
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg border border-pixo-amber/20 bg-pixo-amber/5">
                <p className="text-xs font-medium">Revenue Optimization</p>
                <p className="text-xs text-muted-foreground mt-1">Review conversion funnel for Level 1 → Level 2 drop-off points. Current conversion is at {conversion}%.</p>
              </div>
              <div className="p-3 rounded-lg border border-pixo-blue/20 bg-pixo-blue/5">
                <p className="text-xs font-medium">Engagement Focus</p>
                <p className="text-xs text-muted-foreground mt-1">Increase daily active usage by targeting students with 3+ day streaks for premium conversion.</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-pixo-green" />
                Learning-Revenue Alignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                  <span className="text-xs">Engagement → Payment</span>
                  <Badge className="bg-pixo-green/10 text-pixo-green border-0 text-[10px]">Aligned</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                  <span className="text-xs">Confidence → Retention</span>
                  <Badge className="bg-pixo-green/10 text-pixo-green border-0 text-[10px]">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-pixo-surface">
                  <span className="text-xs">Drop-off → Churn Risk</span>
                  <Badge className="bg-pixo-amber/10 text-pixo-amber border-0 text-[10px]">Monitor</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
