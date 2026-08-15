import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type {
  OxylabsSchedule,
  OxylabsScheduleRun,
  OxylabsScheduleRunInsert,
} from "@/lib/supabase/types";

/**
 * Service-role queries for `oxylabs_schedules` and `oxylabs_schedule_runs`
 * (AGENTS.md §18/§21). All access is server-only via the service-role client;
 * 64-bit Oxylabs ids are stored and compared as text to preserve precision.
 */

/** All stored schedule rows, newest first. */
export async function getStoredSchedules(): Promise<OxylabsSchedule[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load schedules: ${error.message}`);
  }
  return data ?? [];
}

/** Stored schedule rows whose source is still active and whose row is active. */
export async function getActiveStoredSchedules(): Promise<OxylabsSchedule[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("oxylabs_schedules")
    .select("*, sources!inner(active)")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load active schedules: ${error.message}`);
  }

  // The `sources!inner(active)` embed only keeps rows with a source; filter to
  // active sources in JS to avoid the joined-column filter gotcha (§21).
  type Row = OxylabsSchedule & { sources: { active: boolean } | { active: boolean }[] | null };
  return (data ?? [])
    .filter((row) => {
      const src = (row as Row).sources;
      const arr = Array.isArray(src) ? src : src ? [src] : [];
      return arr.some((s) => s.active);
    })
    .map((row) => {
      const copy = { ...(row as Row) } as Partial<Row>;
      delete copy.sources;
      return copy as OxylabsSchedule;
    });
}

/** Create or update the schedule row for a source (unique on `schedule_id`). */
export async function upsertSchedule(row: {
  scheduleId: string;
  sourceId: string;
  cron: string;
  active: boolean;
}): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("oxylabs_schedules").upsert(
    {
      schedule_id: row.scheduleId,
      source_id: row.sourceId,
      cron: row.cron,
      active: row.active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "schedule_id" },
  );

  if (error) {
    throw new Error(
      `Failed to upsert schedule ${row.scheduleId}: ${error.message}`,
    );
  }
}

/** Mark a stored schedule row inactive (mirrors an Oxylabs deactivation). */
export async function deactivateSchedule(scheduleId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("oxylabs_schedules")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("schedule_id", scheduleId);

  if (error) {
    throw new Error(
      `Failed to deactivate schedule ${scheduleId}: ${error.message}`,
    );
  }
}

/** All stored run rows, newest first. */
export async function getStoredRuns(): Promise<OxylabsScheduleRun[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load schedule runs: ${error.message}`);
  }
  return data ?? [];
}

/** Job ids already recorded for a schedule, to skip re-processing (§18). */
export async function getProcessedJobIds(
  scheduleId: string,
): Promise<Set<string>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("oxylabs_schedule_runs")
    .select("job_id")
    .eq("schedule_id", scheduleId)
    .eq("processed", true);

  if (error) {
    throw new Error(
      `Failed to load processed jobs for ${scheduleId}: ${error.message}`,
    );
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.job_id) ids.add(row.job_id);
  }
  return ids;
}

/**
 * Record a run/job row. Append-only; a unique-violation on
 * (schedule_id, run_id, job_id) is treated as already-recorded (race guard).
 */
export async function recordRun(row: OxylabsScheduleRunInsert): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("oxylabs_schedule_runs").insert(row);
  if (error) {
    if (error.code === "23505") return; // already recorded
    throw new Error(
      `Failed to record run ${row.run_id}/${row.job_id ?? "?"}: ${error.message}`,
    );
  }
}

/** Mark a recorded job as processed so it is not handled twice (§18). */
export async function markRunProcessed(
  scheduleId: string,
  runId: string,
  jobId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("oxylabs_schedule_runs")
    .update({ processed: true })
    .eq("schedule_id", scheduleId)
    .eq("run_id", runId)
    .eq("job_id", jobId);

  if (error) {
    throw new Error(
      `Failed to mark run processed ${scheduleId}/${runId}/${jobId}: ${error.message}`,
    );
  }
}
