import "server-only";

import { getActiveSources } from "@/lib/supabase/queries/sources";
import {
  getActiveStoredSchedules,
  getProcessedJobIds,
  markRunProcessed,
  recordRun,
} from "@/lib/supabase/queries/schedules";
import { createLog } from "@/lib/supabase/queries/logs";
import { getJobResultHtml, getScheduleRuns } from "@/lib/scraping/scheduler";
import type { Json, Source } from "@/lib/supabase/types";
import {
  DEFAULT_LIMIT_PER_SOURCE,
  aggregate,
  emptyResult,
  processSourceHtml,
} from "./scrape";
import type { RejectionReason, ScrapeSummary, SourceResult } from "./types";

/**
 * Scheduled result processing (AGENTS.md §18). For each active schedule, reads
 * `/runs`, records every job, and runs the shared scrape-to-insert pipeline on
 * the homepage HTML of each `done` job not already processed. Reuses
 * `processSourceHtml` — identical validation, cleanup, dedupe, URL-existence
 * check, and run logging as manual scraping (§9). Never saves a raw homepage as
 * an article. Server-only; reused by the manual process route and the cron route.
 */

/** Run the scheduler processing pass and return a scrape summary (§18). */
export async function processScheduledResults(
  startedAtMs: number = Date.now(),
): Promise<ScrapeSummary> {
  console.info("[schedule] result processing started");

  const [schedules, sources] = await Promise.all([
    getActiveStoredSchedules(),
    getActiveSources(),
  ]);
  const sourceById = new Map<string, Source>(sources.map((s) => [s.id, s]));
  console.info(
    `[schedule] processing ${schedules.length} active schedule(s)`,
  );

  const results: SourceResult[] = [];
  const reasons: Partial<Record<RejectionReason, number>> = {};

  for (const schedule of schedules) {
    const source = sourceById.get(schedule.source_id);
    if (!source) {
      console.warn(
        `[schedule] schedule ${schedule.schedule_id} has no active source — skipping`,
      );
      continue;
    }

    const result = emptyResult(source);

    let runs;
    try {
      runs = await getScheduleRuns(schedule.schedule_id);
    } catch (err) {
      result.error = err instanceof Error ? err.message : "unknown error";
      console.error(
        `[schedule] ${source.name}: failed to load runs — ${result.error}`,
      );
      results.push(result);
      continue;
    }

    const alreadyProcessed = await getProcessedJobIds(schedule.schedule_id);

    for (const run of runs) {
      for (const job of run.jobs) {
        // Record every job we see so status is visible in the runs list (§14).
        await recordRun({
          schedule_id: schedule.schedule_id,
          run_id: run.runId,
          job_id: job.id,
          result_status: job.resultStatus,
          processed: false,
        });

        // Only done jobs have fetchable results; skip pending/faulted (§18).
        if (job.resultStatus !== "done") continue;
        if (alreadyProcessed.has(job.id)) continue;

        let html: string | null;
        try {
          html = await getJobResultHtml(job.id);
        } catch (err) {
          console.error(
            `[schedule] ${source.name}: job ${job.id} result fetch failed — ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
          continue;
        }
        if (!html) {
          console.warn(
            `[schedule] ${source.name}: job ${job.id} returned no HTML — skipping`,
          );
          continue;
        }

        console.info(
          `[schedule] ${source.name}: processing job ${job.id} homepage HTML`,
        );
        await processSourceHtml(
          source,
          html,
          DEFAULT_LIMIT_PER_SOURCE,
          result,
          reasons,
        );

        await markRunProcessed(schedule.schedule_id, run.runId, job.id);
      }
    }

    results.push(result);
  }

  const summary = aggregate(
    results,
    "completed",
    Date.now() - startedAtMs,
    reasons,
  );

  console.info("[schedule] result processing completed", summary);
  await createLog({
    level: "info",
    event: "schedule.process",
    message: `Scheduled processing: ${summary.articlesInserted} inserted, ${summary.duplicatesSkipped} duplicates, ${summary.articlesRejected} rejected across ${summary.sourcesChecked} schedule(s)`,
    context: summary as unknown as Json,
  });

  return summary;
}
