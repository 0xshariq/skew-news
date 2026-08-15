# Prompt: AI Article Analysis Pipeline (§19)

## Goal

Implement the AI article analysis pipeline described in AGENTS.md §19. Given
articles already scraped and stored in Supabase, detect articles that are
**pending analysis**, run each through an AI model to produce a neutral summary,
sentiment, and AI-estimated political framing, validate the output with Zod, and
save it append-only to `article_analyses`. Expose the run via
`POST /api/analyze`, protected by the admin secret. Analyzed articles then
surface on the home feed and detail page (both already wired to the `analysis`
relation).

**In scope:** §19 only.
**Out of scope (do not build here):**
- §20 pgvector / embeddings — explicitly "after AI analysis is working". No
  `embedding` column, no `text-embedding-3-small`, no Related Articles.
- §18 Oxylabs Scheduler and `/api/cron/pipeline`. The cron route will later call
  this same analysis layer, so the core logic must be reusable, but building the
  cron/scheduler is separate work.

## Skills read

- `.agents/skills/supabase/SKILL.md` — service-role client for server writes,
  RLS/security checklist, "never trust memory, verify against docs", the joined-
  table filter gotcha (§21), verify work after implementing.
- `.agents/skills/ai-sdk/SKILL.md` — **never write AI SDK code from memory**;
  read the version-matched bundled docs in `node_modules/ai/docs/` and
  `node_modules/@ai-sdk/openai/docs/` after install; use `generateObject` for
  structured, schema-validated output; run the type checker after changes.

## Existing code inspected

- `supabase/schema.sql` — `article_analyses` table already fully defined with
  every §19 column and DB checks: `sentiment_score`/`bias_score` in [-1,1],
  `confidence` in [0,1], label CHECK constraints, and
  `left+center+right = 100`. **No schema change required.**
- `lib/supabase/types.ts` — `ArticleAnalysis`, `ArticleAnalysisInsert`,
  `SentimentLabelValue`, `BiasLabelValue` already present and matching. No type
  change required.
- `lib/supabase/queries/articles.ts` — service-role query pattern, `chunk()`
  helper, `firstOf`/`shape` relation normalization, `!inner` embed hint used
  instead of joined-column filters (§21 gotcha).
- `lib/supabase/queries/logs.ts` — `createLog()` (never throws) for the run
  summary log row.
- `lib/pipeline/scrape.ts` + `lib/pipeline/types.ts` — the established pipeline
  shape: typed result/summary objects, neat `console.info` progress logging, a
  final summary object, and a `logs` row at the end. Mirror this style.
- `lib/api/admin-auth.ts` — `isAuthorized(request)` guard reused verbatim.
- `app/api/scrape/route.ts` — thin handler template (auth → parse body → call
  pipeline → return summary; `force-dynamic`, `maxDuration = 300`).
- `lib/supabase/server.ts` — `createServiceClient()` (server-only).
- `.env.example` — has admin/supabase/oxylabs vars but is **missing**
  `OPENAI_API_KEY` and `ANALYSIS_BATCH_SIZE`.
- `package.json` — `ai` and `@ai-sdk/openai` are **not installed**; `zod@4.4.3`
  present transitively but not a direct dependency.

## Decisions / assumptions

1. **Provider:** OpenAI via the Vercel AI SDK, per AGENTS.md §6/§21 (mandatory —
   `OPENAI_API_KEY`, `@ai-sdk/openai`). Not Claude, despite general defaults —
   the project rules override.
2. **Model:** default to `gpt-4o-mini` (cost-appropriate for classification-style
   analysis), stored in one centralized constant and saved to
   `article_analyses.model`. Verify the id is current against the AI SDK/OpenAI
   docs at implement time; do not use a model id from memory.
3. **Install exact packages only:** `ai`, `@ai-sdk/openai`, and promote `zod` to
   a direct dependency. Pin versions and commit the lockfile (skill guidance).
   Look up the current versions at install time; do not invent them.
4. **Structured output:** use `generateObject` with a Zod schema so the model is
   forced into the shape and the SDK validates it. Then run a second explicit Zod
   `safeParse` as the §19 validation gate (percentages sum to 100 within a
   tolerance, label ∈ enum, ranges valid).
5. **Pending detection (§19.1):** LEFT JOIN semantics — an article is pending
   when **no `article_analyses` row exists** for it. Never rely on
   `analyzed_at IS NULL` alone. Implement with
   `.select("*, article_analyses(id)")` then filter in JS to rows whose
   `article_analyses` is empty (avoids the §21 joined-filter gotcha).
6. **bias_score is derived, never modeled:** compute
   `(right_percentage − left_percentage) / 100` in code and round to 3 decimals
   to satisfy the `numeric(4,3)` column. The model returns only the three
   percentages + label.
7. **Percentages normalization:** the model may return percentages that sum to
   99 or 101. Normalize to integers summing to exactly 100 before saving (largest-
   remainder rounding) so the DB `= 100` CHECK never rejects a valid analysis.
8. **Retry policy (§19):** on invalid output, retry once; if still invalid, count
   the article as `failed` and save nothing (no `analyzed_at`, no partial row).
9. **Default behavior:** process **all** pending valid articles, in batches
   (`ANALYSIS_BATCH_SIZE`, default 5), looping until none remain. Respect an
   optional request `limit` and/or explicit `articleIds`. Do not cap at 10.
10. **`analyzed_at`:** set only after the analysis row is successfully saved.

## Files likely to change / add

- `package.json` / `package-lock.json` — add `ai`, `@ai-sdk/openai`, `zod`.
- `.env.example` — add `OPENAI_API_KEY` (server only) and `ANALYSIS_BATCH_SIZE`
  (optional, default 5). Keep in sync with the §21 table.
- `lib/ai/schema.ts` (new) — Zod schema + inferred type for the AI analysis
  output (summary, sentiment score/label, framing label, three percentages,
  confidence, framing notes, loaded terms, disclaimer).
- `lib/ai/analyze-article.ts` (new) — server-only. Builds the prompt from an
  article, calls `generateObject` with the schema + model, returns a validated
  result or a typed failure. Contains the framing rules from §19 in the system
  prompt (AI-estimated, evidence-only, use `unclear` when weak, etc.).
- `lib/supabase/queries/articles.ts` — add `getPendingArticles(limit?)` and
  `saveAnalysis(articleId, insert)` (insert analysis row + set `analyzed_at` only
  after success; append-only, service role).
- `lib/pipeline/analyze.ts` (new) — orchestrator: load pending (or selected)
  articles, batch, call the AI layer, normalize + derive, validate, save, count
  analyzed/skipped/failed, log per-batch and a final summary object + `logs` row.
  Exported `runAnalysis(options)` reusable by the future §18 cron route.
- `lib/pipeline/types.ts` — add `AnalyzeOptions` and `AnalysisSummary` typed
  results (mirror the scrape summary shape).
- `app/api/analyze/route.ts` (new) — thin `POST` handler: `isAuthorized` guard →
  parse `{ limit?, articleIds? }` → `runAnalysis` → return summary.

## Implementation requirements

- All AI/model calls and Supabase writes are **server-only** (`import
  "server-only"`); nothing reaches browser code (§21).
- `POST /api/analyze` requires the `x-SKEW-admin-secret` header; missing/invalid →
  `401` (reuse `isAuthorized`).
- Small functions, explicit types, no `any`, centralized limits/model constant,
  typed pipeline results, safe error handling (one bad article never aborts the
  run).
- Validate every model output with Zod before saving; save only valid analyses;
  set `analyzed_at` only after the row is written.
- Log neat `console.info` progress (run started, N pending, per-batch
  analyzed/skipped/failed, per-article failures at `warn`, run completed) and a
  final summary object, plus one `logs` row via `createLog` (event
  `analyze.summary`). Mirror `lib/pipeline/scrape.ts` tone.
- Use the AI SDK per the **bundled version-matched docs**, not memory. Only set
  non-default options.

## Security requirements

- `OPENAI_API_KEY` server-only; never `NEXT_PUBLIC_`. Add to `.env.example` and
  keep the §21 table in sync.
- Do not expose service role, OpenAI, or admin secret to the browser.
- Admin secret via header only, never query string; `401` on missing/invalid.
- Do not weaken RLS or add `SECURITY DEFINER`; writes go through the existing
  service-role client.

## Acceptance criteria

- `POST /api/analyze` with a valid admin secret analyzes all pending articles by
  default, batching, until none remain; returns a summary with analyzed/skipped/
  failed counts, batches, duration, and per-article failures.
- Pending detection uses the LEFT-JOIN/no-analysis-row rule, not `analyzed_at`
  alone (an article with `analyzed_at` set but no `article_analyses` row is
  re-picked up).
- Each saved analysis has: summary, sentiment score+label, bias label, three
  percentages summing to exactly 100, derived `bias_score`, confidence, framing
  notes, loaded terms, disclaimer, model name; `analyzed_at` set only after save.
- Framing label ∈ {left,center,right,mixed,unclear}, matches strongest
  percentage unless confidence is low/percentages close; weak evidence → `unclear`
  + low confidence. Invalid output retries once then fails without saving.
- Missing/invalid admin secret → `401`. No secret in URL. No browser exposure.
- Analyzed articles appear on the home feed and detail page (already wired).
- `npm run typecheck` and `npm run lint` pass; `npm run build` passes (new route).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new route + server modules)

## Manual test steps (after implementation)

1. Ensure `OPENAI_API_KEY` and `SKEW_ADMIN_SECRET` are set in `.env.local`, and
   at least a few scraped-but-unanalyzed articles exist (run `/api/scrape` first
   if needed). Start `npm run dev` and **watch the dev-server terminal** — batch
   progress logs there (§17).
2. Analyze all pending (default):
   ```bash
   curl -s -X POST http://localhost:3000/api/analyze \
     -H "x-SKEW-admin-secret: $SKEW_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{}' | jq
   ```
   Expect a summary with `analyzed`, `skipped`, `failed`, `batches`, `durationMs`.
3. Analyze a limited batch:
   ```bash
   curl -s -X POST http://localhost:3000/api/analyze \
     -H "x-SKEW-admin-secret: $SKEW_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"limit":3}' | jq
   ```
4. Analyze specific articles:
   ```bash
   curl -s -X POST http://localhost:3000/api/analyze \
     -H "x-SKEW-admin-secret: $SKEW_ADMIN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"articleIds":["<uuid>"]}' | jq
   ```
5. Auth rejection — no header returns `401`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     http://localhost:3000/api/analyze -d '{}'
   ```
6. Re-run step 2 immediately — it should report `0 analyzed` (all pending drained),
   confirming idempotency.
7. Open the home page (`/`) and a news detail page — newly analyzed articles now
   render with sentiment, framing percentages, confidence, summary, framing notes,
   loaded terms, and disclaimer.
