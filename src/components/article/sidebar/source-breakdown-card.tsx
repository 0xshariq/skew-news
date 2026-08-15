import { SidebarCard } from "@/components/ui/sidebar-card";
import { LeanBar } from "@/components/ui/lean-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BiasBreakdown, SourceLean, SourceRef } from "@/lib/types";

interface SourceBreakdownCardProps {
  bias: BiasBreakdown;
  sourceCount: number;
  topSources: SourceRef[];
}

const LEAN_TEXT: Record<SourceLean, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

const LEAN_COLOR: Record<SourceLean, string> = {
  left: "text-bias-left",
  center: "text-text-secondary",
  right: "text-bias-right",
};

/** Sidebar Source Breakdown card: per-lean counts and the Top Sources / Bias list. */
export function SourceBreakdownCard({
  bias,
  sourceCount,
  topSources,
}: SourceBreakdownCardProps) {
  const count = (pct: number) => Math.round((pct / 100) * sourceCount);

  const rows: { lean: SourceLean; pct: number }[] = [
    { lean: "left", pct: bias.left },
    { lean: "center", pct: bias.center },
    { lean: "right", pct: bias.right },
  ];

  return (
    <SidebarCard title="Source Breakdown">
      <p className="text-caption font-medium text-text-secondary">
        {sourceCount} Total Sources
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <LeanBar
            key={row.lean}
            lean={row.lean}
            label={LEAN_TEXT[row.lean]}
            value={`${count(row.pct)} (${row.pct}%)`}
            percent={row.pct}
          />
        ))}
      </div>

      <div className="mt-5 border-t border-divider pt-4">
        <div className="flex items-center justify-between text-caption font-medium text-text-secondary">
          <span>Top Sources</span>
          <span>Bias</span>
        </div>
        <ul className="mt-3 flex flex-col gap-2.5">
          {topSources.map((source) => (
            <li
              key={source.name}
              className="flex items-center justify-between text-body-sm"
            >
              <span className="text-text-primary">{source.name}</span>
              <span className={cn("font-medium", LEAN_COLOR[source.bias])}>
                {LEAN_TEXT[source.bias]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Button variant="outline" className="mt-5 w-full">
        View All Sources
      </Button>
    </SidebarCard>
  );
}
