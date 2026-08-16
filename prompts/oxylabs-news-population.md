# Oxylabs News Population and Daily Automation

## Goal
Populate Supabase with up to 10 valid latest articles per active source through the existing Oxylabs pipeline, then run that ingestion automatically once daily.

## Skills read
- in-repo-oxylabs-web-scraper
- in-repo-supabase

## Existing code inspected
- `src/lib/pipeline/scrape.ts`
- `src/lib/pipeline/cron.ts`
- `src/app/api/cron/pipeline/route.ts`
- `src/app/api/scrape/route.ts`
- `src/lib/scraping/oxylabs.ts`
- `vercel.json`
- Supabase query and pipeline modules

## Decisions
- Use all active Supabase sources at runtime; do not hardcode URLs.
- Default manual and scheduled ingestion to 10 valid articles per source.
- Reuse the existing Oxylabs, Supabase, dedupe, logging, result-processing, and analysis layers.
- Do not install packages or modify dependency manifests/lockfiles.
- Daily cron remains protected by `CRON_SECRET` in production.

## Requirements
- Change the centralized default per-source limit to 10.
- Make the daily pipeline scrape active sources before processing scheduled results and analyzing pending articles.
- Keep source failures partial and observable; do not expose credentials or article bodies in logs.
- Preserve append-only article insertion and URL/canonical URL deduplication.
- Keep route handlers thin and server-only credentials server-side.
- Preserve the existing once-daily Vercel Cron schedule and avoid duplicate schedules.

## Security
- Use existing server-only Oxylabs and Supabase service clients.
- Require the existing cron bearer secret in production.
- Do not accept arbitrary URLs for scheduled ingestion.
- Return safe errors only.

## Acceptance criteria
- Manual scrape defaults to 10 valid articles per active source.
- Daily cron invokes the same active-source scrape and then the existing result/analysis stages.
- Repeated runs are idempotent and do not duplicate articles.
- Partial source errors are represented in summaries/logs without stopping other sources.
- No dependency files change.

## Checks
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Inspect diff for secrets, hardcoded production URLs, and duplicate cron entries.

## Manual tests
- POST `/api/scrape` with the existing admin secret and `{}`; verify all active sources and up to 10 valid inserts per source.
- Repeat the request and verify duplicates are skipped.
- Call `/api/cron/pipeline` without and with an invalid bearer token in production-like configuration; verify 401.
- Call it with the valid `CRON_SECRET`; verify scrape, processing, analysis, and logging summary.
- Confirm Vercel has one daily cron entry for `/api/cron/pipeline`.

## Files likely to change
- `src/lib/pipeline/scrape.ts`
- `src/lib/pipeline/cron.ts`
- potentially `src/lib/pipeline/types.ts` only if summary typing requires it
- no dependency files
- `vercel.json` only if the existing daily schedule is absent or incorrect

## Visual interpretation
No UI redesign; stored articles continue flowing into the existing home page through the current data layer.

## Exact implementation scope
Only update the centralized limit and cron orchestration needed to populate current news daily. Do not add alternate storage, mock data, hardcoded source URLs, new packages, or client-side scraping.

## Post-implementation steps
Run the checks above and provide the user with exact local curl commands using their configured secret to trigger the initial population and verify idempotency.
