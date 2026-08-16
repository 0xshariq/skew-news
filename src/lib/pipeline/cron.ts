import "server-only";

import { createLog } from "@/lib/supabase/queries/logs";
import { DEFAULT_LIMIT_PER_SOURCE, runManualScrape } from "./scrape";
import { processScheduledResults } from "./process-results";
import { runAnalysis } from "./analyze";
import type { Json } from "@/lib/supabase/types";
import type { CronPipelineSummary } from "./types";

const SAFE_STAGE_ERROR = "Pipeline stage failed";

function logStageFailure(stage: string, error: unknown): void {
  const kind = error instanceof Error ? error.name : "UnknownError";
  console.error(`[cron] ${stage} failed (${kind})`);
}

/**
 * Automatic daily pipeline (AGENTS.md §18). Scrapes all active sources through
 * the existing Oxylabs pipeline, then processes scheduled results and analyzes
 * pending articles. Each stage is isolated so one failure does not prevent the
 * remaining stages from running. Server-only; the cron route is the only caller.
 */
export async function runCronPipeline(
  startedAtMs: number = Date.now(),
): Promise<CronPipelineSummary> {
  console.info("[cron] pipeline started");

  // Step one: populate current news from every active source.
  let scrape: CronPipelineSummary["scrape"];
  try {
    scrape = await runManualScrape({
      limitPerSource: DEFAULT_LIMIT_PER_SOURCE,
    });
  } catch (err) {
    logStageFailure("news scrape", err);
    scrape = { status: "failed", error: SAFE_STAGE_ERROR };
  }

  // Step two: process scheduled results. Never let a failure skip analysis.
  let process: CronPipelineSummary["process"];
  try {
    process = await processScheduledResults();
  } catch (err) {
    logStageFailure("result processing", err);
    process = { status: "failed", error: SAFE_STAGE_ERROR };
  }

  // Step three: analyze all pending articles (runs regardless of earlier steps).
  let analyze: CronPipelineSummary["analyze"];
  try {
    analyze = await runAnalysis();
  } catch (err) {
    logStageFailure("analysis", err);
    analyze = { status: "failed", error: SAFE_STAGE_ERROR };
  }

  const failedStages = [scrape, process, analyze].filter(
    (stage) => stage.status === "failed",
  ).length;
  const status: CronPipelineSummary["status"] =
    failedStages === 3
      ? "failed"
      : failedStages > 0
        ? "partial"
        : "completed";

  const summary: CronPipelineSummary = {
    status,
    scrape,
    process,
    analyze,
    durationMs: Date.now() - startedAtMs,
  };

  console.info("[cron] pipeline completed", summary);
  await createLog({
    level: status === "completed" ? "info" : "error",
    event: "cron.pipeline",
    message: `Cron pipeline: scrape=${scrape.status}, process=${process.status}, analyze=${analyze.status}`,
    context: summary as unknown as Json,
  });

  return summary;
}
