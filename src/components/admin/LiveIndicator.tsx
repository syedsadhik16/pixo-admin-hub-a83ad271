import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  status: string;
  className?: string;
}

export function LiveIndicator({ status, className }: LiveIndicatorProps) {
  const isLive = status === "SUBSCRIBED";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        isLive ? "bg-pixo-green animate-pulse" : "bg-muted-foreground/40"
      )} />
      {isLive && <span className="text-[8px] font-mono text-pixo-green uppercase">LIVE</span>}
    </span>
  );
}
