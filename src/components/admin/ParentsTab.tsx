import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Heart } from "lucide-react";

export function ParentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-parents-full"],
    queryFn: async () => {
      const [parentsRes, profilesRes, linksRes] = await Promise.all([
        supabase.from("parent_profiles").select("user_id, relationship_label, created_at"),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("parent_children").select("parent_user_id, student_user_id, relation_type, status"),
      ]);

      const profMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
      const linksByParent = new Map<string, { name: string; relation: string }[]>();
      (linksRes.data ?? []).forEach(l => {
        if (l.status !== "active") return;
        const child = profMap.get(l.student_user_id);
        const arr = linksByParent.get(l.parent_user_id) ?? [];
        arr.push({ name: child?.full_name ?? l.student_user_id.slice(0, 8), relation: l.relation_type ?? "—" });
        linksByParent.set(l.parent_user_id, arr);
      });

      return (parentsRes.data ?? []).map(p => {
        const profile = profMap.get(p.user_id);
        const children = linksByParent.get(p.user_id) ?? [];
        return {
          user_id: p.user_id,
          name: profile?.full_name ?? "—",
          email: profile?.email ?? "—",
          relationshipLabel: p.relationship_label ?? "parent",
          childrenCount: children.length,
          children,
        };
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4" />
          Parent Registry
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Heart} title="No parents" description="No parent profiles found in the backend." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono-label">Parent</TableHead>
                <TableHead className="font-mono-label">Email</TableHead>
                <TableHead className="font-mono-label">Relationship</TableHead>
                <TableHead className="font-mono-label">Linked Children</TableHead>
                <TableHead className="font-mono-label">Children</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(p => (
                <TableRow key={p.user_id}>
                  <TableCell className="text-xs font-medium">{p.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-xs capitalize">{p.relationshipLabel}</TableCell>
                  <TableCell><Badge variant={p.childrenCount > 0 ? "default" : "outline"}>{p.childrenCount}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {p.children.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : p.children.map(c => `${c.name} (${c.relation})`).join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
