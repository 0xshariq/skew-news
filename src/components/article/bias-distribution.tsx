import { BiasMeter } from "@/components/ui/bias-meter";
import { InfoIcon } from "@/components/ui/icons";
import type { BiasBreakdown } from "@/lib/types";

interface BiasDistributionProps {
  bias: BiasBreakdown;
  sourceCount: number;
}

/** Inline "Bias Distribution" panel — AI-estimated framing across sources. */
export function BiasDistribution({ bias, sourceCount }: BiasDistributionProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-h4 font-semibold text-text-primary">
          Bias Distribution
        </h2>
        <span className="text-text-secondary">
          <InfoIcon size={14} />
        </span>
      </div>

      <BiasMeter left={bias.left} center={bias.center} right={bias.right} />

      <p className="mt-2 text-caption text-text-secondary">
        {sourceCount} sources
      </p>
    </div>
  );
}
