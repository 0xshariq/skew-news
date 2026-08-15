import "server-only";

import { OxylabsError } from "./oxylabs";

/**
 * Oxylabs Scheduler (Data API) client (AGENTS.md §18/§21).
 *
 * The Scheduler lives on `data.oxylabs.io`, separate from the Realtime
 * `universal` client in `oxylabs.ts`. It creates recurring homepage scrape
 * jobs, lists schedules, reads per-job run status, toggles schedule state, and
 * pulls completed job result HTML.
 *
 * Large-integer precision (§18, critical): `schedule_id` and job `id` are 64-bit
 * integers that exceed `Number.MAX_SAFE_INTEGER`. `JSON.parse` silently corrupts
 * their last digits, so we read them from the raw response text with regex and
 * keep them as strings everywhere. Never round-trip these IDs through a number.
 *
 * Credentials are server-only and never appear in an error message.
 */

const DATA_API_BASE = "https://data.oxylabs.io";

/** Push-Pull result retrieval can take a moment; keep the client bounded. */
const SCHEDULER_TIMEOUT_MS = 60_000;

/** One completed/pending job inside a schedule run (§18 — use /runs, not /jobs). */
export interface ScheduleRunJob {
  /** 64-bit job id, kept as a string. */
  id: string;
  /** `pending` | `done` | `faulted`. Only `done` jobs have fetchable results. */
  resultStatus: string;
}

/** One run of a schedule with its per-job statuses. */
export interface ScheduleRun {
  /** 64-bit run id, kept as a string. */
  runId: string;
  jobs: ScheduleRunJob[];
}

/** Result of creating an Oxylabs schedule. */
export interface CreateScheduleResult {
  /** 64-bit schedule id, extracted from raw text, kept as a string. */
  scheduleId: string;
  active: boolean;
}

function credentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) {
    throw new OxylabsError(
      "Missing Oxylabs env vars (OXY_WSA_USERNAME / OXY_WSA_PASSWORD)",
    );
  }
  return { username, password };
}

function authHeader(): string {
  const { username, password } = credentials();
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/** Fetch a Data API URL with basic auth, a timeout, and no credential leakage. */
async function requestRaw(
  path: string,
  init: { method: string; body?: string } = { method: "GET" },
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCHEDULER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${DATA_API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: init.body,
      signal: controller.signal,
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? `timed out after ${SCHEDULER_TIMEOUT_MS}ms`
        : "network error";
    throw new OxylabsError(`Oxylabs Scheduler request failed (${reason}) for ${path}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new OxylabsError(
      `Oxylabs Scheduler returned ${response.status} for ${path}`,
      response.status,
    );
  }
  return { status: response.status, text };
}

/**
 * Extract every run-of-digits that looks like a 64-bit id following a JSON key.
 * Operates on raw text so precision is preserved (§18).
 */
function extractIdAfterKey(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
  return match ? match[1] : null;
}

/**
 * Create one hourly schedule for a source homepage. `items` is a single
 * `universal` job so the schedule maps 1:1 to a source (§18). `end_time` is
 * required by Oxylabs; a far-future value makes the schedule effectively
 * permanent. Returns the exact `schedule_id` string.
 */
export async function createSchedule(params: {
  cron: string;
  homepageUrl: string;
  endTime: string;
}): Promise<CreateScheduleResult> {
  const body = JSON.stringify({
    cron: params.cron,
    end_time: params.endTime,
    items: [{ source: "universal", url: params.homepageUrl, render: "html" }],
  });

  const { text } = await requestRaw("/v1/schedules", { method: "POST", body });

  const scheduleId = extractIdAfterKey(text, "schedule_id");
  if (!scheduleId) {
    throw new OxylabsError(
      "Oxylabs Scheduler create response missing schedule_id",
    );
  }
  // `active` is a small bool — safe to read from a parsed copy.
  const active = /"active"\s*:\s*true/.test(text);

  return { scheduleId, active };
}

/**
 * List all Oxylabs schedule ids for the account. Ids are read from raw text to
 * preserve 64-bit precision (§18) — the response is a flat array of integers.
 */
export async function listSchedules(): Promise<string[]> {
  const { text } = await requestRaw("/v1/schedules");
  // Response shape: { "schedules": [ <id>, <id>, ... ] }.
  const arrayMatch = text.match(/"schedules"\s*:\s*\[([^\]]*)\]/);
  if (!arrayMatch) return [];
  const ids = arrayMatch[1].match(/\d+/g);
  return ids ?? [];
}

/**
 * Get the runs for a schedule with per-job `result_status` (§18 — always use
 * `/runs`, never `/jobs`, which lacks status). Run and job ids are parsed from
 * raw text to preserve precision.
 */
export async function getScheduleRuns(scheduleId: string): Promise<ScheduleRun[]> {
  const { text } = await requestRaw(`/v1/schedules/${scheduleId}/runs`);
  return parseRuns(text);
}

/**
 * Parse the `/runs` response body into typed runs. Extracted for unit-safety:
 * each job object is isolated by its brace span so the run/job ids and status
 * stay aligned, and all ids remain strings.
 */
function parseRuns(raw: string): ScheduleRun[] {
  const runs: ScheduleRun[] = [];
  // Split on run_id occurrences; each segment holds one run's jobs array.
  const runRegex = /"run_id"\s*:\s*(\d+)([\s\S]*?)(?="run_id"|$)/g;
  let runMatch: RegExpExecArray | null;
  while ((runMatch = runRegex.exec(raw)) !== null) {
    const runId = runMatch[1];
    const segment = runMatch[2];
    const jobs: ScheduleRunJob[] = [];

    // Each job object carries an `id` then later a `result_status`.
    const jobRegex =
      /"id"\s*:\s*(\d+)[\s\S]*?"result_status"\s*:\s*"([^"]+)"/g;
    let jobMatch: RegExpExecArray | null;
    while ((jobMatch = jobRegex.exec(segment)) !== null) {
      jobs.push({ id: jobMatch[1], resultStatus: jobMatch[2] });
    }
    runs.push({ runId, jobs });
  }
  return runs;
}

/** Deactivate (or reactivate) a schedule (§18 orphan cleanup). */
export async function setScheduleState(
  scheduleId: string,
  active: boolean,
): Promise<void> {
  await requestRaw(`/v1/schedules/${scheduleId}/state`, {
    method: "PUT",
    body: JSON.stringify({ active }),
  });
}

/**
 * Pull a completed job's homepage HTML via Push-Pull result retrieval. Returns
 * null when the result has no usable content so the caller can skip it. Only
 * call for jobs with `result_status === 'done'` (§18). The content itself is
 * plain HTML, so a normal `JSON.parse` here is fine — no 64-bit ids are read.
 */
export async function getJobResultHtml(jobId: string): Promise<string | null> {
  const { text } = await requestRaw(`/v1/queries/${jobId}/results`);

  let payload: { results?: Array<{ content?: unknown }> };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new OxylabsError(`Oxylabs returned invalid JSON for job ${jobId}`);
  }

  const content = payload.results?.[0]?.content;
  if (typeof content !== "string" || content === "") return null;
  return content;
}
