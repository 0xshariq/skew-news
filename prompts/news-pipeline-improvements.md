# News Pipeline Improvements

## Goal
Harden manually populated news and automated ingestion without installing packages.

## Skills read
- in-repo-oxylabs-web-scraper
- in-repo-supabase

## Existing code inspected
- Homepage and Supabase article queries
- Manual scrape and cron routes
- Scrape pipeline and status types
- Existing repository instructions and Vercel schedule

## Decisions
- Preserve analyzed-only feed semantics.
- Use a safe maximum of 10 articles per source.
- Require cron authorization outside explicit local development.
- Keep user-facing errors generic and server diagnostics minimal.
- Bound homepage results to 60 newest analyzed articles.

## Implementation
- Add pending-analysis count query and accurate homepage empty state.
- Validate and clamp manual scrape limits at API and pipeline boundaries.
- Require CRON_SECRET unless NODE_ENV is development and `SKEW_ALLOW_LOCAL_CRON=true`.
- Redact raw errors from logs and responses.
- Bound homepage article query.

## Acceptance checks
- Typecheck, lint, build, git diff --check.
- Verify pending and analyzed homepage states.
- Verify invalid scrape limits, cron auth, and bounded query behavior.
