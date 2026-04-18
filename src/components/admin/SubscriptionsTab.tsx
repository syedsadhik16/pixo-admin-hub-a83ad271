import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Search, CreditCard } from "lucide-react";

type PlanFilter = "all" | "free" | "premium" | "trial" | "expired";

interface SubscriptionRow {
  user_id: string;
  studentName: string;
  parentNames: string[];
  plan: string;
  paymentStatus: string;
  entitlementActive: boolean;
  validUntil: string | null;
  daysToRenewal: number | null;
}

function planBucket(plan: string | null, isActive: boolean, validUntil: string | null): PlanFilter {
  if (validUntil && new Date(validUntil) < new Date()) return "expired";
  if (!isActive) return "expired";
  const p = (plan ?? "").toLowerCase();
  if (p === "trial") return "trial";
  if (p === "free" || p === "") return "free";
  return "premium";
}

function badgeVariant(bucket: PlanFilter) {
  switch (bucket) {
    case "premium": return "default" as const;
    case "trial":   return "secondary" as const;
    case "expired": return "destructive" as const;
    default:        return "outline" as const;
  }
}

export function SubscriptionsTab() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PlanFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async (): Promise<SubscriptionRow[]> => {
      const [entRes, profRes, linksRes] = await Promise.all([
        supabase.from("user_entitlements").select("user_id, plan_name, payment_status, is_active, valid_until"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("parent_children").select("parent_user_id, student_user_id").eq("status", "active"),
      ]);

      const profMap = new Map((profRes.data ?? []).map(p => [p.id, p]));
      const parentsByStudent = new Map<string, string[]>();
      (linksRes.data ?? []).forEach(l => {
        const arr = parentsByStudent.get(l.student_user_id) ?? [];
        const parent = profMap.get(l.parent_user_id);
        if (parent?.full_name) arr.push(parent.full_name);
        parentsByStudent.set(l.student_user_id, arr);
      });

      return (entRes.data ?? []).map(e => {
        const p = profMap.get(e.user_id);
        const validUntil = e.valid_until;
        const days = validUntil
          ? Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000)
          : null;
        return {
          user_id: e.user_id,
          studentName: p?.full_name ?? p?.email ?? e.user_id.slice(0, 8),
          parentNames: parentsByStudent.get(e.user_id) ?? [],
          plan: e.plan_name ?? "—",
          paymentStatus: e.payment_status ?? "—",
          entitlementActive: !!e.is_active,
          validUntil,
          daysToRenewal: days,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter(r => {
      const bucket = planBucket(r.plan, r.entitlementActive, r.validUntil);
      if (filter !== "all" && bucket !== filter) return false;
      if (search && !r.studentName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, filter, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscriptions & Entitlements
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs w-44"
              />
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as PlanFilter)}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No subscriptions" description="No entitlements match the current filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono-label">Student</TableHead>
                <TableHead className="font-mono-label">Linked Parent(s)</TableHead>
                <TableHead className="font-mono-label">Plan</TableHead>
                <TableHead className="font-mono-label">Payment</TableHead>
                <TableHead className="font-mono-label">Entitlement</TableHead>
                <TableHead className="font-mono-label">Expiry</TableHead>
                <TableHead className="font-mono-label">Renewal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(row => {
                const bucket = planBucket(row.plan, row.entitlementActive, row.validUntil);
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="text-xs font-medium">{row.studentName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.parentNames.length > 0 ? row.parentNames.join(", ") : "—"}
                    </TableCell>
                    <TableCell><Badge variant={badgeVariant(bucket)} className="capitalize">{row.plan}</Badge></TableCell>
                    <TableCell className="text-xs capitalize">{row.paymentStatus}</TableCell>
                    <TableCell>
                      <Badge variant={row.entitlementActive ? "default" : "outline"}>
                        {row.entitlementActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.validUntil ? new Date(row.validUntil).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.daysToRenewal === null
                        ? "—"
                        : row.daysToRenewal < 0
                          ? <span className="text-destructive">Expired {Math.abs(row.daysToRenewal)}d ago</span>
                          : <span>{row.daysToRenewal}d left</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
