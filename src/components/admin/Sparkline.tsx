import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from "recharts";

interface SparklineProps {
  data: { day: string; value: number }[];
  color?: string;
  height?: number;
  width?: number | string;
}

/**
 * Compact recharts line for in-row mini-trends.
 * `data` should be sorted ascending by day. If empty, renders a flat baseline.
 */
export function Sparkline({ data, color = "hsl(var(--primary))", height = 32, width = 120 }: SparklineProps) {
  const safeData = useMemo(() => (data.length > 0 ? data : [{ day: "", value: 0 }, { day: "", value: 0 }]), [data]);
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safeData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <RTooltip
            contentStyle={{
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 8px",
            }}
            formatter={(value: number) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
            labelFormatter={(label) => String(label)}
            cursor={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
