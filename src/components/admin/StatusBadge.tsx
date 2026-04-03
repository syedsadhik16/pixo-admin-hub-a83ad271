import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "on_track" | "at_risk" | "critical" | "captured" | "failed" | "pending" | "refunded" | "draft" | "published" | "active" | "inactive";

const variants: Record<StatusType, string> = {
  on_track: "bg-pixo-green/10 text-pixo-green border-pixo-green/20",
  at_risk: "bg-pixo-amber/10 text-pixo-amber border-pixo-amber/20",
  critical: "bg-pixo-red/10 text-pixo-red border-pixo-red/20",
  captured: "bg-pixo-green/10 text-pixo-green border-pixo-green/20",
  failed: "bg-pixo-red/10 text-pixo-red border-pixo-red/20",
  pending: "bg-pixo-amber/10 text-pixo-amber border-pixo-amber/20",
  refunded: "bg-pixo-blue/10 text-pixo-blue border-pixo-blue/20",
  draft: "bg-muted text-muted-foreground border-border",
  published: "bg-pixo-green/10 text-pixo-green border-pixo-green/20",
  active: "bg-pixo-green/10 text-pixo-green border-pixo-green/20",
  inactive: "bg-muted text-muted-foreground border-border",
};

const labels: Record<StatusType, string> = {
  on_track: "ON TRACK",
  at_risk: "AT RISK",
  critical: "CRITICAL",
  captured: "CAPTURED",
  failed: "FAILED",
  pending: "PENDING",
  refunded: "REFUNDED",
  draft: "DRAFT",
  published: "PUBLISHED",
  active: "ACTIVE",
  inactive: "INACTIVE",
};

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/\s+/g, "_") as StatusType;
  return (
    <Badge
      variant="outline"
      className={cn("font-mono-label text-[9px] px-2 py-0.5", variants[key] ?? variants.inactive, className)}
    >
      {labels[key] ?? status.toUpperCase()}
    </Badge>
  );
}
