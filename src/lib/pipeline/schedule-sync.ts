import "server-only";

import { getActiveSources } from "@/lib/supabase/queries/sources";
import {
  deactivateSchedule,
  getStoredSchedules,
  upsertSchedule,
} from "@/lib/supabase/queries/schedules";
import { createLog } from "@/lib/supabase/queries/logs";
import {
  createSchedule,
  listSchedules,
  setScheduleState,
} from "@/lib/scraping/scheduler";
import type { Json } from "@/lib/supabase/types";
import type { ScheduleSyncResult, ScheduleSyncSummary } from "./types";

/**
 * Schedule sync (AGENTS.md §18). Creates one hourly Oxylabs schedule per active
 * source homepage, persists a row per source, then deactivates orphaned Oxylabs
 * schedules that are no longer tracked in the DB so they stop billing. Idempotent:
 * an active source whose stored schedule still exists on Oxylabs is reused, not
 * recreated. Server-only; reused by the sync route.
 */

/** Oxylabs runs each source homepage at the top of every hour (§18). */
export const SCHEDULE_CRON = "0 * * * *";
/** Oxylabs requires end_time; far-future makes the schedule effectively permanent. */
const SCHEDULE_END_TIME = "2099-12-31 23:59:59";

/** Create/reuse schedules for active sources and deactivate orphans (§18). */
export async function syncSchedules(
  startedAtMs: number = Date.now(),
): Promise<ScheduleSyncSummary> {
  console.info("[schedule] sync started");

  const [sources, stored] = await Promise.all([
    getActiveSources(),
    getStoredSchedules(),
  ]);
  console.info(
    `[schedule] ${sources.length} active source(s), ${stored.length} stored schedule(s)`,
  );

  // Current Oxylabs schedule ids — used both to reuse and to find orphans.
  const oxylabsIds = new Set(await listSchedules());

  const bySource = new Map(stored.map((row) => [row.source_id, row]));
  const results: ScheduleSyncResult[] = [];
  let created = 0;
  let reused = 0;

  for (const source of sources) {
    const existing = bySource.get(source.id);

    // Reuse when the stored schedule still exists and is active on Oxylabs.
    if (existing && oxylabsIds.has(existing.schedule_id)) {
      if (!existing.active) {
        await upsertSchedule({
          scheduleId: existing.schedule_id,
          sourceId: source.id,
          cron: SCHEDULE_CRON,
          active: true,
        });
      }
      reused += 1;
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        scheduleId: existing.schedule_id,
        action: "existing",
      });
      console.info(
        `[schedule] ${source.name}: reusing schedule ${existing.schedule_id}`,
      );
      continue;
    }

    // Otherwise create a fresh schedule for this source homepage.
    console.info(`[schedule] ${source.name}: creating schedule for ${source.listing_url}`);
    const { scheduleId } = await createSchedule({
      cron: SCHEDULE_CRON,
      homepageUrl: source.listing_url,
      endTime: SCHEDULE_END_TIME,
    });
    await upsertSchedule({
      scheduleId,
      sourceId: source.id,
      cron: SCHEDULE_CRON,
      active: true,
    });
    created += 1;
    results.push({
      sourceId: source.id,
      sourceName: source.name,
      scheduleId,
      action: "created",
    });
    console.info(`[schedule] ${source.name}: created schedule ${scheduleId}`);
  }

  // Orphan deactivation (§18): any Oxylabs schedule not tracked by the schedules
  // we just synced is deactivated so it stops running hourly.
  const trackedIds = new Set(results.map((r) => r.scheduleId));
  let orphansDeactivated = 0;
  for (const oxylabsId of oxylabsIds) {
    if (trackedIds.has(oxylabsId)) continue;
    try {
      await setScheduleState(oxylabsId, false);
      await deactivateSchedule(oxylabsId); // no-op if the row is absent
      orphansDeactivated += 1;
      console.info(`[schedule] deactivated orphan schedule ${oxylabsId}`);
    } catch (err) {
      console.error(
        `[schedule] failed to deactivate orphan ${oxylabsId}: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  const summary: ScheduleSyncSummary = {
    status: "completed",
    sourcesChecked: sources.length,
    schedulesCreated: created,
    schedulesReused: reused,
    orphansDeactivated,
    durationMs: Date.now() - startedAtMs,
    schedules: results,
  };

  console.info("[schedule] sync completed", summary);
  await createLog({
    level: "info",
    event: "schedule.sync",
    message: `Schedule sync: ${created} created, ${reused} reused, ${orphansDeactivated} orphans deactivated across ${sources.length} source(s)`,
    context: summary as unknown as Json,
  });

  return summary;
}
