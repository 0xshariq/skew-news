import { SidebarCard } from "@/components/ui/sidebar-card";
import { LeanBar } from "@/components/ui/lean-bar";
import { Button } from "@/components/ui/button";
import type { BiasBreakdown, FramingLabel } from "@/lib/types";

interface BiasAnalysisCardProps {
  bias: BiasBreakdown;
  biasLabel: FramingLabel;
  sourceCount: number;
}

const LABEL_TEXT: Record<FramingLabel, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  mixed: "Mixed",
  unclear: "Unclear",
};

/** Sidebar Bias Analysis card. Framing is AI-estimated, not objective truth (§19). */
export function BiasAnalysisCard({
  bias,
  biasLabel,
  sourceCount,
}: BiasAnalysisCardProps) {
  const strongest = Math.max(bias.left, bias.center, bias.right);

  return (
    <SidebarCard title="Bias Analysis">
      <p className="text-caption font-medium text-text-secondary">Overall Bias</p>
      <p className="mt-1 text-h2 font-bold text-accent">
        {LABEL_TEXT[biasLabel]} {strongest}%
      </p>
      <p className="mt-1 text-body-sm text-accent">
        Based on {sourceCount} balanced sources
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <LeanBar lean="left" label="Left" value={`${bias.left}%`} percent={bias.left} />
        <LeanBar
          lean="center"
          label="Center"
          value={`${bias.center}%`}
          percent={bias.center}
        />
        <LeanBar
          lean="right"
          label="Right"
          value={`${bias.right}%`}
          percent={bias.right}
        />
      </div>

      <p className="mt-4 text-body-sm text-text-secondary">
        Our AI-estimated analysis is based on the political leaning of the
        publication and how the story is framed. Sources are weighted by reliability
        and recency.
      </p>

      <Button variant="outline" className="mt-4 w-full">
        How We Analyze Bias
      </Button>
    </SidebarCard>
  );
}
