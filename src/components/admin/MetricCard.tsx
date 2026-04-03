import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  className?: string;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon, className }: MetricCardProps) {
  return (
    <div className={cn("pixo-metric-card animate-fade-in", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {Icon && (
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
        )}
      </div>
      {change && (
        <p className={cn(
          "text-xs mt-2 font-medium",
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
