import "server-only";

import { createLog } from "@/lib/supabase/queries/logs";
import { processScheduledResults } from "./process-results";
import { runAnalysis } from "./analyze";
import type { Json } from "@/lib/supabase/types";
import type { CronPipelineSummary } from "./types";

/**
 * Automatic hourly pipeline (AGENTS.md §18). Runs scheduled result processing,
 * then AI analysis of all pending articles. If processing throws, analysis still
 * runs — there may be pre-existing unanalyzed articles. Server-only; the cron
 * route is the only caller.
 */
export async function runCronPipeline(
  startedAtMs: number = Date.now(),
): Promise<CronPipelineSummary> {
  console.info("[cron] pipeline started");

  // Step one: process scheduled results. Never let a failure skip analysis.
  let process: CronPipelineSummary["process"];
  try {
    process = await processScheduledResults();
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] result processing failed — ${error}`);
    process = { status: "failed", error };
  }

  // Step two: analyze all pending articles (runs regardless of step one).
  let analyze: CronPipelineSummary["analyze"];
  try {
    analyze = await runAnalysis();
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] analysis failed — ${error}`);
    analyze = { status: "failed", error };
  }

  const status =
    process.status === "failed" && analyze.status === "failed"
      ? "failed"
      : "completed";

  const summary: CronPipelineSummary = {
    status,
    process,
    analyze,
    durationMs: Date.now() - startedAtMs,
  };

  console.info("[cron] pipeline completed", summary);
  await createLog({
    level: status === "failed" ? "error" : "info",
    event: "cron.pipeline",
    message: `Cron pipeline: process=${process.status}, analyze=${analyze.status}`,
    context: summary as unknown as Json,
  });

  return summary;
}
