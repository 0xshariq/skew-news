import { cn } from "@/lib/utils";
import type { SourceLean } from "@/lib/types";

const BAR_BG: Record<SourceLean, string> = {
  left: "bg-bias-left",
  center: "bg-bias-center",
  right: "bg-bias-right",
};

interface LeanBarProps {
  lean: SourceLean;
  /** Left-aligned label, e.g. "Left". */
  label: string;
  /** Right-aligned value, e.g. "20%" or "2 (20%)". */
  value: string;
  /** Bar fill width as a percentage 0–100. */
  percent: number;
  className?: string;
}

/** One lean row: label, value, and a thin proportional colored bar. */
export function LeanBar({ lean, label, value, percent, className }: LeanBarProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-body-sm">
        <span className="text-text-primary">{label}</span>
        <span className="font-medium text-text-secondary">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-secondary">
        <div
          style={{ width: `${percent}%` }}
          className={cn("h-full rounded-full", BAR_BG[lean])}
        />
      </div>
    </div>
  );
}
