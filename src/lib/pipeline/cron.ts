import "server-only";

import { createLog } from "@/lib/supabase/queries/logs";
import { runManualScrape } from "./scrape";
import { processScheduledResults } from "./process-results";
import { runAnalysis } from "./analyze";
import type { Json } from "@/lib/supabase/types";
import type { CronPipelineSummary } from "./types";

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
    scrape = await runManualScrape({ limitPerSource: 10 });
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] news scrape failed — ${error}`);
    scrape = { status: "failed", error };
  }

  // Step two: process scheduled results. Never let a failure skip analysis.
  let process: CronPipelineSummary["process"];
  try {
    process = await processScheduledResults();
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] result processing failed — ${error}`);
    process = { status: "failed", error };
  }

  // Step three: analyze all pending articles (runs regardless of earlier steps).
  let analyze: CronPipelineSummary["analyze"];
  try {
    analyze = await runAnalysis();
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] analysis failed — ${error}`);
    analyze = { status: "failed", error };
  }

  const status =
    scrape.status === "failed" &&
    process.status === "failed" &&
    analyze.status === "failed"
      ? "failed"
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
    level: status === "failed" ? "error" : "info",
    event: "cron.pipeline",
    message: `Cron pipeline: scrape=${scrape.status}, process=${process.status}, analyze=${analyze.status}`,
    context: summary as unknown as Json,
  });

  return summary;
}
