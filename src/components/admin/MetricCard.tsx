import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  mono?: boolean;
  className?: string;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon, mono, className }: MetricCardProps) {
  return (
    <div className={cn("pixo-metric-card", className)}>
      <div className="flex items-start justify-between mb-3">
        <p className="font-mono-label text-muted-foreground">{title}</p>
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
      <p className={cn("text-2xl font-semibold tracking-tight", mono && "font-mono")}>{value}</p>
      {change && (
        <p className={cn(
          "text-xs mt-1.5",
          changeType === "positive" && "text-pixo-green",
          changeType === "negative" && "text-pixo-red",
          changeType === "neutral" && "text-muted-foreground",
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
