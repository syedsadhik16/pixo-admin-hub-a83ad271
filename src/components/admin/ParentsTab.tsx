import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { Heart, Download } from "lucide-react";
import { exportAndDownload } from "@/lib/admin/csv";
import { toast } from "sonner";

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
          childrenSummary: children.length === 0 ? "—" : children.map(c => `${c.name} (${c.relation})`).join("; "),
        };
      });
    },
  });

  async function exportCsv() {
    if (!data) return;
    await exportAndDownload(
      `pixo-parents-${new Date().toISOString().slice(0, 10)}`,
      data,
      [
        { key: "name", label: "Parent Name" },
        { key: "email", label: "Email" },
        { key: "relationshipLabel", label: "Relationship" },
        { key: "childrenCount", label: "Linked Children" },
        { key: "childrenSummary", label: "Children" },
        { key: "user_id", label: "User ID" },
      ],
      "parents",
    );
    toast.success("Parents CSV exported");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Parent Registry
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={exportCsv}
            disabled={!data || data.length === 0}
          >
            <Download className="h-3.5 w-3.5" />Export CSV
          </Button>
        </div>
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
