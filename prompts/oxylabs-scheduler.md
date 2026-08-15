# Oxylabs Scheduler + Vercel Cron — Implementation Prompt

## Goal

Implement the Oxylabs Scheduler and Vercel Cron layer (AGENTS.md §18) so that active
source homepages are scraped automatically every hour and turned into analyzed
articles with **no manual intervention** after one-time setup.

Deliver all parts together (§18):

1. **Sync schedules route** — `POST /api/oxylabs/schedules`: create one Oxylabs
   schedule per active source, persist rows, and deactivate orphaned Oxylabs
   schedules.
2. **List schedules route** — `GET /api/oxylabs/schedules`: read stored schedule rows.
3. **List runs route** — `GET /api/oxylabs/runs`: read stored run rows (§14).
4. **Manual process route** — `POST /api/oxylabs/scheduled-results/process`:
   on-demand processing of completed Oxylabs job results.
5. **Cron pipeline route** — `GET /api/cron/pipeline`: chains process-results then
   AI analysis, protected by `CRON_SECRET`.
6. **Vercel Cron config** — `vercel.json` registering the hourly trigger at :15.

## Skills read

- `.agents/skills/oxylabs-web-scraper/SKILL.md` — Web Scraper API auth, `universal`
  source, Data API (`data.oxylabs.io`) push-pull endpoint.
- `.agents/skills/supabase/SKILL.md` — service-role-only server access, RLS-with-no-
  policies, joined-filter gotcha.
- Live Oxylabs Scheduler docs fetched from
  `https://developers.oxylabs.io/products/web-scraper-api/features/scheduler`
  (endpoint paths, request/response fields confirmed against the live page, not memory).

## Live Oxylabs Scheduler API (confirmed from docs)

Base: `https://data.oxylabs.io`. Basic auth with `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`.

| Purpose | Method + path | Notes |
| --- | --- | --- |
| Create schedule | `POST /v1/schedules` | body: `cron`, `items` (array of job param sets), `end_time` ("YYYY-MM-DD HH:MM:SS"). Returns `schedule_id` (64-bit int), `active`, `next_run_at`. |
| List schedules | `GET /v1/schedules` | returns `{ schedules: [<id>, ...] }` (raw 64-bit ints). |
| Get schedule runs | `GET /v1/schedules/{id}/runs` | returns `runs[].jobs[]` each with `id`, `result_status` (`pending`\|`done`\|`faulted`), timestamps. **Use this, not `/jobs`** (§18). |
| Toggle state | `PUT /v1/schedules/{id}/state` | body `{ "active": false }`, returns HTTP 202 empty. |
| Fetch job result | `GET /v1/queries/{job_id}/results` | Push-Pull result retrieval; `results[0].content` is the homepage HTML. |

**Large-integer precision (§18, critical):** `schedule_id` and job `id` exceed
`Number.MAX_SAFE_INTEGER`. Never let them pass through `JSON.parse` as numbers. Read
them from the **raw response text** with regex/string extraction and keep them as
strings everywhere (DB columns are already `text`).

## Existing code inspected

- `supabase/schema.sql` — `oxylabs_schedules` and `oxylabs_schedule_runs` tables
  **already exist** (ids as `text`, RLS enabled, no policies). **No schema change needed.**
- `lib/supabase/types.ts` — `OxylabsSchedule`, `OxylabsScheduleRun`, and their `Insert`
  types **already defined**. No type change needed.
- `lib/pipeline/scrape.ts` — exports `processSourceHtml(source, homepageHtml,
  limitPerSource, result, reasons)` and `DEFAULT_LIMIT_PER_SOURCE`, plus internal
  `emptyResult`/`aggregate`. The scheduler must **reuse `processSourceHtml`** with
  job-result HTML — do not duplicate pipeline logic (§18). `emptyResult` and
  `aggregate` are currently module-private; they will be exported for reuse.
- `lib/pipeline/analyze.ts` — exports `runAnalysis(options)`. Cron step two calls it
  with no options (all pending).
- `lib/pipeline/types.ts` — `SourceResult`, `ScrapeSummary`, `RejectionReason`.
- `lib/scraping/oxylabs.ts` — Realtime `universal` client (`fetchHtml`). The Data API
  scheduler client is separate; it stays server-only and never echoes credentials.
- `lib/api/admin-auth.ts` — `isAuthorized(request)` guards action routes via
  `x-SKEW-admin-secret`. Reused as-is by the two action routes.
- `lib/supabase/queries/sources.ts` — `getActiveSources()`.
- `lib/supabase/server.ts` — `createServiceClient()` (service role).
- `app/api/scrape/route.ts`, `app/api/analyze/route.ts` — thin-handler pattern to
  mirror (`dynamic = "force-dynamic"`, `maxDuration`, JSON parse guard, PostHog capture).

## Decisions / assumptions

- **Cron cadence.** Oxylabs schedule cron = `0 * * * *` (top of every hour). Vercel
  Cron = `15 * * * *` (15 min later, §18). Configurable only via a single constant.
- **One schedule per source.** Each schedule has exactly one `items` entry:
  `{ source: "universal", url: <listing_url>, render: "html" }`. This maps cleanly to
  the per-source `oxylabs_schedules.source_id` row.
- **`end_time`.** Oxylabs requires it. Use a far-future constant (`2099-12-31 23:59:59`)
  so schedules effectively never expire.
- **Sync is idempotent per source.** If an active source already has an
  `oxylabs_schedules` row whose Oxylabs schedule is still listed and active, skip
  re-creating it (avoids piling up duplicate hourly schedules → duplicate Oxylabs bill).
  Recreate only when the stored schedule is missing from Oxylabs' `GET /v1/schedules`.
- **Orphan deactivation (§18).** After creating schedules, `GET /v1/schedules`, diff
  against `schedule_id`s stored for **active** sources, and `PUT .../state {active:false}`
  on any Oxylabs id not tracked. Also mark the corresponding DB row inactive if present.
- **Run dedupe.** Record each processed job in `oxylabs_schedule_runs`
  (`schedule_id`, `run_id`, `job_id`, `result_status`, `processed`). Only fetch results
  and run the pipeline for jobs with `result_status === 'done'` that are **not already
  marked processed** (unique constraint `(schedule_id, run_id, job_id)` guards races).
- **Process reuses the pipeline.** For each done job: fetch result HTML → look up the
  source by the schedule's `source_id` → call `processSourceHtml` with
  `DEFAULT_LIMIT_PER_SOURCE` → aggregate into a `ScrapeSummary`. Same validation,
  cleanup, dedupe, URL-existence check, and run logging as manual scraping (§9/§18).
- **Cron resilience (§18).** If process-results throws, step two (analysis) still runs —
  there may be pre-existing unanalyzed articles. Errors are logged, not swallowed silently.
- **Local dev secret skip (§18).** The cron route skips the `CRON_SECRET` check when
  `process.env.NODE_ENV !== "production"` so it can be curled locally. In production a
  missing/wrong secret → `401`. `CRON_SECRET` is **not** added to `.env.local`/`.env.example`.

## Files likely to change / add

**New:**
- `lib/scraping/scheduler.ts` — Data API client: `createSchedule`, `listSchedules`,
  `getScheduleRuns`, `setScheduleState`, `getJobResultHtml`. Raw-text ID extraction.
  Server-only, typed errors, no credential leakage.
- `lib/pipeline/schedule-sync.ts` — `syncSchedules()`: create-per-source + orphan
  deactivation; returns a sync summary object.
- `lib/pipeline/process-results.ts` — `processScheduledResults()`: reuse
  `processSourceHtml`; returns a `ScrapeSummary`.
- `lib/supabase/queries/schedules.ts` — CRUD helpers on `oxylabs_schedules` /
  `oxylabs_schedule_runs` (all service role): `getStoredSchedules`, `upsertSchedule`,
  `deactivateSchedule`, `getStoredRuns`, `recordRun`, `markRunProcessed`,
  `getActiveStoredSchedules`.
- `app/api/oxylabs/schedules/route.ts` — `POST` (sync, admin-secret) + `GET` (list).
- `app/api/oxylabs/runs/route.ts` — `GET` (list stored runs).
- `app/api/oxylabs/scheduled-results/process/route.ts` — `POST` (admin-secret).
- `app/api/cron/pipeline/route.ts` — `GET` (CRON_SECRET-guarded).
- `vercel.json` — cron entry `{ "path": "/api/cron/pipeline", "schedule": "15 * * * *" }`.

**Edited:**
- `lib/pipeline/scrape.ts` — export `emptyResult` and `aggregate` for reuse.
- `lib/pipeline/types.ts` — add `ScheduleSyncSummary` and any scheduler result types.
- `.env.example` — document `CRON_SECRET` as Vercel-injected (comment only; no value),
  matching the §21 table. Confirm `OXY_WSA_*` already covers Scheduler auth (it does).
- `AGENTS.md` §21 env table already lists `CRON_SECRET`; no change needed there.

## Implementation requirements

- TypeScript throughout; no `any`. Small functions, explicit types, server-only modules.
- Thin route handlers — orchestration lives in `lib/pipeline/*`, Oxylabs I/O in
  `lib/scraping/scheduler.ts`, DB in `lib/supabase/queries/schedules.ts`.
- Reuse `processSourceHtml` and `runAnalysis`; **do not** re-implement scraping,
  validation, cleanup, dedupe, or analysis.
- Preserve run logging (§9): neat `[schedule]` / `[cron]` console lines during runs and
  a final summary object; write a `logs` row for sync, process, and cron summaries.
- Method rules (§14): `POST` for sync + process, `GET` for list + runs + cron.

## Security requirements

- `POST /api/oxylabs/schedules` and `POST /api/oxylabs/scheduled-results/process`
  require `x-SKEW-admin-secret` → `401` on missing/invalid (§15). Secret never in URL.
- `GET /api/cron/pipeline` guarded by `CRON_SECRET` (§18): `401` on missing/wrong in
  production; skip check in dev. Never guard the cron route with `SKEW_ADMIN_SECRET`.
- Oxylabs credentials, service-role key, and all secrets stay server-only; error
  messages never echo auth. No Oxylabs/DB calls from browser code (§21).
- 64-bit IDs handled as strings from raw response text — never round-tripped through a
  JS number (§18).

## Acceptance criteria

- `POST /api/oxylabs/schedules` creates one Oxylabs schedule per active source, stores
  a row per source with the exact `schedule_id` string, deactivates orphans, and returns
  a sync summary. Re-running does not create duplicate Oxylabs schedules.
- `GET /api/oxylabs/schedules` returns stored schedule rows; `GET /api/oxylabs/runs`
  returns stored run rows.
- `POST /api/oxylabs/scheduled-results/process` fetches `/runs`, processes only
  `result_status === 'done'` jobs not already processed, runs the shared pipeline on the
  result HTML, inserts valid articles, and returns a `ScrapeSummary`.
- `GET /api/cron/pipeline` runs process-then-analyze; analysis still runs if processing
  fails; returns `401` in production without a valid `CRON_SECRET`.
- `vercel.json` registers `/api/cron/pipeline` at `15 * * * *`.
- No article is ever saved from a raw homepage/listing result (guaranteed by pipeline reuse).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes + server modules added)

## Manual test steps (shared after implementation)

Watch the `npm run dev` terminal for `[schedule]` / `[cron]` logs (§17).

```bash
# 1. Create/sync Oxylabs schedules (one per active source) + deactivate orphans
curl -X POST http://localhost:3000/api/oxylabs/schedules \
  -H "x-SKEW-admin-secret: $SKEW_ADMIN_SECRET"

# 2. List stored schedule rows
curl http://localhost:3000/api/oxylabs/schedules

# 3. (Wait for the top of an hour for Oxylabs to run, then) process completed results
curl -X POST http://localhost:3000/api/oxylabs/scheduled-results/process \
  -H "x-SKEW-admin-secret: $SKEW_ADMIN_SECRET"

# 4. List stored runs
curl http://localhost:3000/api/oxylabs/runs

# 5. Run the full cron pipeline locally (secret check skipped in dev)
curl http://localhost:3000/api/cron/pipeline

# 6. Confirm articles appear on the home page after analysis sets analyzed_at
```

One-time production setup (documented, not run here): set `SKEW_ADMIN_SECRET` and
`CRON_SECRET` (Vercel injects `CRON_SECRET` automatically) in Vercel env, call the sync
route once, and deploy so `vercel.json` registers the hourly cron.
