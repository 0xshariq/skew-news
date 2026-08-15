# Supabase Database and Data Access

## Goal

Stand up SKEW's Supabase data layer and wire the UI to it:

1. **Schema** — the six core tables from AGENTS.md §7 (`sources`, `articles`, `article_analyses`, `logs`, `oxylabs_schedules`, `oxylabs_schedule_runs`) in `supabase/schema.sql`, **without** the `embedding` column (that arrives in §20 after pgvector is enabled).
2. **Seed** — `supabase/seed.sql` inserting the five AGENTS.md §11 example sources (Reuters, NPR, Fox, BBC, Guardian) as active rows with their homepage `listing_url`s.
3. **Types** — a hand-written `Database` type plus row/insert convenience types in `lib/supabase/types.ts`.
4. **Client** — a server-only service-role Supabase client factory.
5. **Queries** — typed read functions for the pages (analyzed articles, single article detail, sources) plus a small logs writer.
6. **Wire pages** — point the home feed and news detail page at these queries via a mapping layer, replacing the mock source, with empty/not-found states.

This is the foundational data layer. The scraping, scheduler, and AI-analysis pipelines are **out of scope** (separate tasks) — but the schema and query surfaces they depend on are created here. The `embedding` column, `getRelatedArticles`, and the Related Stories data source are deferred to §20.

## Skills read

- `.agents/skills/supabase/SKILL.md` → verify against changelog before implementing; **enable RLS on every table in an exposed schema**; never expose the service-role key to the browser; newly created tables may not be auto-exposed to the Data API (we deliberately keep them unexposed and read via service role); the joined-table filter gotcha; pin package versions + commit lockfile.
- AGENTS.md §7 (schema fields), §8–§13 (fields the scraper populates), §14–§15 (route/secret conventions — future tasks), §19 (analysis fields + card/detail display requirements), §20 (pgvector deferral), §21 (env vars, server/client boundary, joined-table filter gotcha).

## Existing code inspected

- `package.json` → Next.js **16.2.10**, React 19, Tailwind v4. **No Supabase package installed.** Node v24.
- `.env.local` → already contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. `.env.example` currently only lists Clerk vars.
- No `supabase/` dir, no `lib/supabase/`, no Supabase CLI, no `.mcp.json` (MCP reachable but unauthenticated → **schema is applied by the user in the Dashboard SQL Editor**, matching AGENTS.md §7).
- `lib/types.ts` → view-model types `NewsArticleCard`, `NewsArticleDetail`, `BiasBreakdown`, `FramingLabel`, `SentimentLabel`, `SourceLean`, `SourceRef`. **These are the presentational contract; components consume them.**
- `lib/mock/news.ts` → `MOCK_ARTICLES` + `getArticleDetail(id)`. Consumed by `app/page.tsx` (home grid) and `app/news/[id]/page.tsx` (detail). The design-system page (`app/design-system/page.tsx`) also uses mock data.
- Components consuming the view models: `components/ui/news-card.tsx`, `bias-meter.tsx`, `article/*` (header, hero, body, bias-distribution, related-stories), `article/sidebar/*` (bias-analysis-card, ai-summary-card, source-breakdown-card), `ui/related-story-card.tsx`.
- Clerk (prior task): pages are async Server Components; `/news/[id]` is auth-protected via `proxy.ts`. Home is public.

## Key modeling decision (mock cluster → single-article schema)

The mock treats a "story" as a **cluster of many sources** with an aggregate L/C/R breakdown, a `sources` count, and a `topSources` list. The real schema (AGENTS.md §7/§19) is **one article = one source**; the L/C/R percentages, `bias_label`, `sentiment_label`, `confidence`, `summary`, `framing_notes`, `loaded_terms`, `disclaimer` are all **per that single article**. We map honestly and **do not redesign** the multi-source sidebar visuals (that would be an unrequested UI overhaul). Mapping:

**Card (`NewsArticleCard`)** — extend the type with optional real fields so the mock/design-system page keeps compiling and `news-card.tsx` renders §19 data when present:
- add optional `source?`, `publishedDate?`, `sentimentLabel?`, `biasLabel?`, `confidence?`.
- mapper fills: `source`=source name, `publishedDate`=formatted `published_at`, `bias`={left,center,right}%, `sentimentLabel`, `biasLabel`, `confidence`. Keep required `id`, `title`, `imageUrl`. Set `category`=source name, `country`=Title-cased `sentiment_label`, `sources`=1 as compatible fallbacks.

**Detail (`NewsArticleDetail`)** — mapper fills every field from `articles` + `article_analyses` + `sources`:
- `author`←source name · `publishedDate`←formatted `published_at` · `readTime`←derived from word count
- `imageCaption`←`title` · `imageCredit`←source name · `bodyParagraphs`←`raw_text` split into paragraphs
- `bias`/`biasLabel`/`sentimentLabel`/`confidence`/`framingNotes`/`loadedTerms`/`disclaimer`←analysis
- `summaryPoints`←`summary` split into points (by line, else sentence) · `summaryGenerated`←formatted `analyzed_at` · `summaryReadTime`←derived
- `sourceCount`←1 · `topSources`←`[{ name: source name, bias: lean(bias_label) }]`
- `related`←`[]` (pgvector Related Articles is §20; `RelatedStories` already renders nothing on empty)

Only analyzed articles are shown (§18: "articles only appear on the homepage after `analyzed_at` is set"). `getHomeArticles` inner-joins `article_analyses` so unanalyzed rows never surface.

## Decisions / assumptions

- **Package**: install `@supabase/supabase-js` v2 only. **Not** `@supabase/ssr` — auth is Clerk, and all DB access is server-side/service-role, so cookie-based SSR clients aren't needed. Pin the exact resolved version; commit `package-lock.json`. Verify current v2 changelog for breaking changes during implementation.
- **Single client**: `lib/supabase/server.ts` exposing `createServiceClient()` (service-role key, `import "server-only"`, `auth: { persistSession: false, autoRefreshToken: false }`). **No browser client** is created (YAGNI — no client-side Supabase usage yet; the anon key stays reserved for future realtime/client reads). All page reads run in Server Components through the service-role client.
- **Security / RLS**: `alter table ... enable row level security;` on **all six** tables and **create no anon/authenticated policies** — the Data API therefore exposes nothing to the browser, and every app read/write goes through the service-role client (which bypasses RLS). This matches AGENTS.md §21 (server-only pipeline reads/writes) and the skill's "enable RLS on every exposed-schema table."
- **Large-int precision (§18)**: Oxylabs `schedule_id`/`run_id`/`job_id` are 64-bit and unsafe as JS numbers, so they are stored as **`text`** columns. Never parsed as numbers.
- **IDs are `uuid`** (`gen_random_uuid()`); timestamps `timestamptz`. `articles.image_url` and `articles.published_at` are **`not null`** (AGENTS.md §7/§13: required before saving). `article_analyses.article_id` is **unique** (one analysis per article), enabling the §19 LEFT-JOIN pending check and §20 embedding backfill.
- **Percentage integrity**: `left/center/right_percentage` are `int` 0–100 with a table `check (left+center+right = 100)`; scores are `numeric` with range checks; labels are `text` with `check (... in (...))` constraints.
- **Page freshness**: add `export const dynamic = "force-dynamic"` to `app/page.tsx` and `app/news/[id]/page.tsx` so they always reflect current DB state (data changes when the pipeline runs).
- **Joined-filter gotcha (§21)**: never `.eq('foreignTable.col', v)`. Requiring an analysis is done with the `article_analyses!inner(...)` embed hint, not a foreign-column filter.
- **Schema application**: no CLI/MCP available → deliver `supabase/schema.sql` + `supabase/seed.sql` for the user to run in the Dashboard SQL Editor. I cannot execute SQL against the project from here; I verify the code layer with typecheck/lint/build and give exact SQL run steps.
- `.env.example`: add the three Supabase vars. Oxylabs/OpenAI/admin/cron vars are added by their own feature tasks.
- **Scope guard**: no scraping, analysis, scheduler, API routes, or embedding column now. No multi-source sidebar redesign.

## Files to add / change

**Add**
- `supabase/schema.sql` — six tables, constraints, indexes, `enable row level security` on each.
- `supabase/seed.sql` — five active sources (idempotent `insert ... on conflict (listing_url) do nothing`).
- `lib/supabase/types.ts` — `Database` type + `Source`/`Article`/`ArticleAnalysis`/`Log`/`OxylabsSchedule`/`OxylabsScheduleRun` row types + `*Insert` types.
- `lib/supabase/server.ts` — `createServiceClient()` (server-only, service-role).
- `lib/supabase/queries/articles.ts` — `getHomeArticles()`, `getArticleDetailById(id)`.
- `lib/supabase/queries/sources.ts` — `getActiveSources()`, `getAllSources()`.
- `lib/supabase/queries/logs.ts` — `createLog(entry)` writer (+ optional `getRecentLogs(limit)`).
- `lib/supabase/mappers.ts` — `toCardView(...)`, `toDetailView(...)`, plus `splitParagraphs`, `readTimeFromText`, `leanFromLabel`, date formatting helpers.

**Change**
- `package.json` / `package-lock.json` — add `@supabase/supabase-js`.
- `.env.example` — add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (placeholders).
- `lib/types.ts` — add the optional `NewsArticleCard` fields above.
- `components/ui/news-card.tsx` — when real fields are present, render `source · publishedDate` (top) and a footer line with framing label · sentiment · `confidence`%; otherwise fall back to the existing `category · country` / `{sources} sources` rendering. Grammar-safe pluralization for the fallback.
- `app/page.tsx` — `async`; `const articles = await getHomeArticles()`; map through `toCardView`; empty state when none; `dynamic = "force-dynamic"`.
- `app/news/[id]/page.tsx` — replace `getArticleDetail` (mock) with `await getArticleDetailById(id)` → `toDetailView`; `notFound()` when null; `dynamic = "force-dynamic"`.
- `lib/mock/news.ts` — **keep** (still used by `app/design-system/page.tsx`); do not delete.

## Implementation requirements

### `supabase/schema.sql`
```sql
-- extensions
create extension if not exists pgcrypto;  -- gen_random_uuid()

-- sources
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  parser_strategy text,
  active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

-- articles (append-only; §10)
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  url text not null unique,              -- original URL, dedupe key (§10)
  canonical_url text,
  title text not null,
  image_url text not null,               -- required before saving (§13)
  published_at timestamptz not null,     -- required before saving (§13)
  raw_text text not null default '',
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz,               -- null until analysis saved (§19)
  created_at timestamptz not null default now()
);
create index if not exists articles_source_id_idx on public.articles(source_id);
create index if not exists articles_published_at_idx on public.articles(published_at desc);
create index if not exists articles_analyzed_at_idx on public.articles(analyzed_at);

-- article_analyses (one per article; §19) — no embedding column yet (§20)
create table if not exists public.article_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles(id) on delete cascade,
  summary text not null,
  sentiment_score numeric(4,3) not null check (sentiment_score >= -1 and sentiment_score <= 1),
  sentiment_label text not null check (sentiment_label in ('positive','neutral','negative')),
  bias_score numeric(4,3) not null check (bias_score >= -1 and bias_score <= 1),
  bias_label text not null check (bias_label in ('left','center','right','mixed','unclear')),
  left_percentage int not null check (left_percentage between 0 and 100),
  center_percentage int not null check (center_percentage between 0 and 100),
  right_percentage int not null check (right_percentage between 0 and 100),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  framing_notes text,
  loaded_terms text[] not null default '{}',
  disclaimer text,
  model text not null,
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_sum check (left_percentage + center_percentage + right_percentage = 100)
);

-- logs (§7)
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  event text not null,
  message text,
  context jsonb,
  source_id uuid references public.sources(id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists logs_created_at_idx on public.logs(created_at desc);

-- oxylabs_schedules (§18; ids stored as text for 64-bit precision)
create table if not exists public.oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_id text not null unique,
  source_id uuid not null references public.sources(id) on delete cascade,
  cron text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- oxylabs_schedule_runs (§18; run/job ids as text)
create table if not exists public.oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id text not null references public.oxylabs_schedules(schedule_id) on delete cascade,
  run_id text not null,
  job_id text,
  result_status text,
  processed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (schedule_id, run_id, job_id)
);
create index if not exists oxylabs_runs_schedule_idx on public.oxylabs_schedule_runs(schedule_id);

-- RLS: enable on every table; no anon/authenticated policies →
-- all access is via the server service-role client (bypasses RLS).
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_analyses enable row level security;
alter table public.logs enable row level security;
alter table public.oxylabs_schedules enable row level security;
alter table public.oxylabs_schedule_runs enable row level security;
```

### `supabase/seed.sql`
Insert five active sources with homepage `listing_url`s (from AGENTS.md §11 examples), idempotent:
```sql
insert into public.sources (name, listing_url, active) values
  ('Reuters',      'https://www.reuters.com/',        true),
  ('NPR',          'https://www.npr.org/',            true),
  ('Fox News',     'https://www.foxnews.com/',        true),
  ('BBC',          'https://www.bbc.com/news',        true),
  ('The Guardian', 'https://www.theguardian.com/us',  true)
on conflict (listing_url) do nothing;
```

### `lib/supabase/server.ts`
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

### `lib/supabase/types.ts`
Hand-write a `Database` interface (`public.Tables.<table>.{Row,Insert,Update}`) matching the schema exactly, and export convenience row/insert types. `loaded_terms` → `string[]`; `context` → `Json | null`. Keep it minimal but accurate.

### Queries (`lib/supabase/queries/*.ts`)
- `getHomeArticles()`: `createServiceClient().from('articles').select('*, sources(*), article_analyses!inner(*)').not('analyzed_at','is',null).order('published_at',{ascending:false})`. Return typed rows (article + source + analysis). Handle `article_analyses` arriving as array or object.
- `getArticleDetailById(id)`: `.select('*, sources(*), article_analyses(*)').eq('id', id).maybeSingle()`; return `null` if not found or no analysis.
- `getActiveSources()` / `getAllSources()`: select from `sources`, filter `active` in JS or via `.eq('active', true)` (own-table filter is fine).
- `createLog(entry)`: insert one row into `logs`. `getRecentLogs(limit=50)` optional read.
- All throw on `error` with a clear message; small functions, explicit return types.

### Mappers (`lib/supabase/mappers.ts`)
Pure functions turning query rows into `NewsArticleCard` / `NewsArticleDetail` per the mapping table above. Include `splitParagraphs(raw)`, `readTimeFromText(raw)`, `leanFromLabel(biasLabel): SourceLean` (`left→left`, `right→right`, everything else→`center`), and a date formatter (`"MMM D, YYYY"` via `Intl.DateTimeFormat`, UTC).

### Page wiring
- `app/page.tsx`: `async`, `export const dynamic = "force-dynamic"`, fetch + map to cards, render existing grid, empty state ("No analyzed articles yet — run the pipeline to populate the feed.") when none.
- `app/news/[id]/page.tsx`: `export const dynamic = "force-dynamic"`, `const article = await getArticleDetailById(id)`; `if (!article) notFound()`; map via `toDetailView`; keep the existing component tree.

## Security requirements

- `SUPABASE_SERVICE_ROLE_KEY` is **server-only**: referenced solely in `lib/supabase/server.ts`, which begins with `import "server-only"`. Never imported by a client component.
- Only `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` may reach the browser; the service key never does.
- RLS enabled on all six tables with **no** anon/authenticated policies → Data API exposes nothing publicly; reads go through the service role server-side.
- `.env.example` holds placeholders only; real keys stay in `.env.local` (gitignored).
- No Supabase calls, service-role usage, or secrets in any client component.

## Acceptance criteria

- `supabase/schema.sql` + `supabase/seed.sql` run cleanly in the Dashboard SQL Editor; all six tables exist with the stated constraints, indexes, and RLS enabled; five active sources seeded.
- `npm run typecheck`, `npm run lint`, and `npm run build` all pass.
- Home page (`/`) renders from Supabase: empty state on an empty DB; once analyzed articles exist, cards show source, published date, framing meter, framing label, sentiment, and confidence (§19).
- `/news/[id]` renders detail from Supabase for a real analyzed article id; `notFound()` for unknown/unanalyzed ids. Related Stories section is absent (empty) — reserved for §20.
- No service-role key or non-public value in the client bundle. `lib/mock/news.ts` still compiles (design-system page unaffected).
- `.env.example`, `supabase/schema.sql`, and `lib/supabase/types.ts` are mutually consistent (AGENTS.md §7).

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new server modules + changed pages/routes affect the build)

## Manual test steps

1. **Apply schema**: Supabase Dashboard → SQL Editor → paste `supabase/schema.sql` → Run. Confirm six tables under Table Editor and RLS "Enabled" on each.
2. **Seed sources**: run `supabase/seed.sql` → confirm five rows in `sources`, all `active = true`.
3. Ensure `.env.local` has the three Supabase vars (already present).
4. `npm run dev`.
5. Visit `http://localhost:3000/` while signed in → home renders with the **empty state** (DB has no analyzed articles yet). No console errors.
6. Insert one smoke-test row set via SQL Editor (a `sources` row exists; insert an `articles` row with `image_url`, `published_at`, `analyzed_at = now()`, and a matching `article_analyses` row with valid percentages summing to 100). Reload `/` → the card appears with source, date, framing meter, framing/sentiment labels, and confidence.
7. Click the card → `/news/<id>` renders the full analysis (summary points, framing percentages, confidence, framing notes, loaded terms, disclaimer). No Related Stories section.
8. Visit `/news/does-not-exist` → Next.js `not-found`.
9. Delete the smoke-test rows if desired. Re-run `npm run typecheck && npm run lint && npm run build` → all pass.
