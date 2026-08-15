# Prompt: News Details Page UI (SKEW)

## Goal

Build the SKEW **news details page** at `app/news/[id]/page.tsx` to match the attached
reference: the shared top bar + site header, a two-column article layout (main article
column + analysis sidebar), a "Related Stories" grid, a newsletter CTA band, and the
shared footer. Display-only. No scraping, no analysis, no pipeline mutation, no live
Supabase reads yet (data layer not built) — render from typed mock data so the layout can
be validated pixel-close now and swapped to real Supabase queries later without touching
the presentational components. UI must display stored data only (AGENTS.md §5).

## Skills read

- `AGENTS.md` — §1 (build list: news details page with full article analysis), §5
  (architecture layers — UI displays data only, no scrape/analyze/mutate), §19 (news
  details page must show summary, sentiment, framing percentages, confidence, framing
  notes, loaded terms, disclaimer; AI-estimated framing labelling; framing label is one
  of left/center/right/mixed/unclear), §20 (Related Articles section, up to 5), §21
  (standards, server/client boundaries), §22 (checks).
- No feature skill applies (clerk/supabase/oxylabs/ai-sdk out of scope for pure UI). Per
  §3, Tailwind/shadcn-style work uses existing project patterns + `@theme` tokens.
- `prompts/design-system.md` and `prompts/home-page-ui.md` — the established token +
  primitive + layout foundation this builds on.

## Existing code inspected

- `app/globals.css` — Tailwind v4 `@theme` tokens: colors (`text-primary`,
  `text-secondary`, `surface`, `bg-primary`, `bg-secondary`, `border`, `divider`,
  `bias-left`/`center`/`right`, `accent`), radius, shadow, `--container-app: 1280px`, and
  `.text-h1…caption` type utilities.
- `app/page.tsx` — home page composing `TopBar`, `SiteHeader`, `CategoryBar`,
  `SiteFooter`, and a `NewsCard` grid from `MOCK_ARTICLES`.
- `components/layout/` — `top-bar.tsx`, `site-header.tsx`, `category-bar.tsx`,
  `site-footer.tsx` (all presentational, reusable as-is).
- `components/ui/` — `bias-meter.tsx` (`{left, center, right}`, optional `showScale`,
  optional `compact`; segmented full-width bar), `news-card.tsx`, `article-card.tsx`
  (horizontal card with image/excerpt/bias/time), `button.tsx`
  (primary/secondary/outline/text, sm/md), `chip.tsx`, `badge.tsx` (small meta label).
- `lib/types.ts` — `BiasBreakdown`, `NewsArticleCard`. `lib/mock/news.ts` —
  `MOCK_ARTICLES`. `lib/utils.ts` — `cn()`.

## Decisions / assumptions

- **Route.** Add `app/news/[id]/page.tsx`. `params` is async in Next 16 — `await params`
  before reading `id`. Look the article up by id from mock data; call `notFound()` when
  missing. (Confirm the async-params + `notFound` conventions against
  `node_modules/next/dist/docs/` before coding, since Next APIs here differ from training.)
- **Make detail reachable.** Wrap `NewsCard` content in a `next/link` to `/news/{id}` so
  home cards navigate to the detail page. Additive, presentational — no other card change.
  Related-story cards on the detail page also link to their `/news/{id}`.
- **Mock data, typed.** Add a `NewsArticleDetail` type to `lib/types.ts` mirroring the
  §19/§20 fields the eventual Supabase query returns, and a `MOCK_ARTICLE_DETAILS` map +
  `getArticleDetail(id)` helper to `lib/mock/news.ts`. When real queries land, only the
  page's data source changes — components stay presentational. Fields:
  - identity/meta: `id`, `title`, `category`, `country`, `author`, `publishedDate` (display
    string), `readTime`, `imageUrl`, `imageCaption`, `imageCredit`
  - body: `bodyParagraphs: string[]`
  - framing: `bias: BiasBreakdown` (left/center/right, sum 100), `biasLabel`
    (`left`|`center`|`right`|`mixed`|`unclear`), `sentimentLabel`
    (`positive`|`neutral`|`negative`), `confidence` (0–1, optional), `framingNotes`,
    `loadedTerms: string[]`, `disclaimer`
  - summary: `summaryPoints: string[]`, `summaryGenerated` (display string), `summaryReadTime`
  - sources: `sourceCount`, `topSources: { name: string; bias: 'left'|'center'|'right' }[]`
  - related: `related: NewsArticleCard[]` (up to 5 per §20; reference shows 6 — cap the
    rendered list at 5 to honour §20, note the cap in a comment)
- **AI-estimated framing.** Label the framing/bias sections as **AI-estimated**, not
  objective truth (§19). The bias percentages drive both the inline "Bias Distribution"
  bar and the sidebar "Bias Analysis" card; the "Overall Bias" headline reads the strongest
  segment (e.g. `Right 49%`), matching the label unless confidence is low (mock data is
  internally consistent).
- **Server Components by default.** Page and all detail components are static Server
  Components. No client interactivity is required (Save/Share/feedback/newsletter are
  visual only — Clerk/forms not wired). Add `"use client"` to nothing here.
- **Reuse over fork.** Reuse `BiasMeter` for both the inline distribution bar and the
  sidebar per-row bars where it fits; reuse `Button` for all CTAs; reuse layout
  `TopBar`/`SiteHeader`/`SiteFooter`. Do not modify existing primitives except the additive
  `NewsCard` link wrap.

## Files likely to change / add

- `app/news/[id]/page.tsx` — detail route: compose top bar, header, article column +
  sidebar, related stories, newsletter CTA, footer from mock detail data.
- `components/article/article-header.tsx` — breadcrumb (`Category · Country`), `text-h1`
  title, byline row (`By {author} · {date} · {readTime}` left; Save / Share / more actions
  right as visual icon buttons).
- `components/article/article-hero.tsx` — 16:9 hero image, caption + `Photo: {credit}`.
- `components/article/bias-distribution.tsx` — bordered inline "Bias Distribution" panel
  (info icon, full-width `BiasMeter` with L/Center/Right, `{n} sources` under it).
- `components/article/article-body.tsx` — renders `bodyParagraphs` as `text-body-lg`
  paragraphs with comfortable measure and spacing.
- `components/article/related-stories.tsx` + `components/ui/related-story-card.tsx` —
  "Related Stories" heading + 2-col grid of compact cards (small thumbnail, `Category ·
  Country` caption, title, `date · readTime`). Capped at 5 (§20).
- `components/article/sidebar/bias-analysis-card.tsx` — "Bias Analysis" card: title + info
  icon, "Overall Bias" `{Label} {pct}%` (accent), "Based on {n} balanced sources", three
  Left/Center/Right rows (label, %, thin colored bar), explanatory copy, "How We Analyze
  Bias" outline button. Framed as AI-estimated.
- `components/article/sidebar/ai-summary-card.tsx` — "AI Summary" card: title + info icon,
  "Generated {date} · {readTime}", bulleted `summaryPoints`, "AI summaries can make
  mistakes." disclaimer, "Provide Feedback" outline button.
- `components/article/sidebar/source-breakdown-card.tsx` — "Source Breakdown" card: title +
  info icon, "{n} Total Sources", Left/Center/Right count rows with bars, a `Top Sources /
  Bias` two-column list (source name + colored bias label), "View All Sources" button.
- `components/ui/sidebar-card.tsx` — shared bordered white card shell with header
  (title + info icon) used by the three sidebar cards, to avoid repetition.
- `components/layout/newsletter-cta.tsx` — "Stay Informed. Stay Balanced." band: heading +
  subcopy left, email input + Subscribe button right (visual only, no submit).
- `lib/types.ts` — add `NewsArticleDetail` (and small helper unions for labels).
- `lib/mock/news.ts` — add `MOCK_ARTICLE_DETAILS` + `getArticleDetail(id)`; seed the "Trump
  Sends Iran…" story from the reference plus a couple more so navigation from other cards
  degrades gracefully (fallback detail generated from the card, or `notFound()`).
- `components/ui/news-card.tsx` — wrap in `Link` to `/news/{id}` (additive).

## Visual interpretation (from reference)

- **Overall layout.** Below the shared header, a centered `max-w-(--container-app)` region
  with 24px side padding, split into a two-column grid: main article column (~2fr) + sticky
  analysis sidebar (~1fr, ~360px), 32–40px gutter. Collapses to a single column below
  `lg`; sidebar stacks under the article on mobile.
- **Article header.** Small secondary breadcrumb `Politics · United States`; large bold
  `text-h1` title (2 lines); byline row `By David Morgan · May 31, 2026 · 12 min read` in
  secondary text on the left, and Save (bookmark) / Share / ⋯ ghost icon-buttons on the
  right.
- **Hero.** Full-width 16:9 image, `rounded-md`; below it a `text-caption` secondary caption
  and a `Photo: Andrew Harnik/Getty Images` credit.
- **Bias Distribution panel.** A bordered `rounded-lg` white box: "Bias Distribution" label
  + info icon; a full-width segmented L/Center/Right bar (`BiasMeter`, tokens
  `bias-left`/`center`/`right`, labels `Left 20%` / `Center 31%` / `Right 49%`); `12
  sources` below.
- **Body.** Comfortable `text-body-lg` paragraphs, ~16px, generous line-height and
  paragraph spacing; a pull quote paragraph reads inline (no special styling required).
- **Related Stories.** Section heading, then a 2-col grid of compact horizontal cards:
  ~64–80px square thumbnail left, `Category · Country` caption, 2-line title, `date ·
  readTime` meta. Cap at 5.
- **Sidebar — Bias Analysis.** White `rounded-lg` bordered card. Header "Bias Analysis" +
  info icon. "Overall Bias" small label; big accent `Right 49%`; "Based on 12 balanced
  sources" (accent link-style). Three rows: `Left  20%` with a thin red bar,
  `Center 31%` grey, `Right 49%` blue — bar width ∝ percentage. Then two lines of
  explanatory copy in secondary text. "How We Analyze Bias" full-width outline button.
- **Sidebar — AI Summary.** "AI Summary" + info icon; "Generated May 31, 2026 · 3 min read"
  caption; 5 bulleted key points (`text-body-md`); "AI summaries can make mistakes."
  secondary caption; "Provide Feedback" outline button.
- **Sidebar — Source Breakdown.** "Source Breakdown" + info icon; "12 Total Sources"; three
  Left/Center/Right count rows (`2 (20%)` etc.) with bars; a `Top Sources / Bias` table
  where each row is a source name + a right-aligned bias label colored by lean (Right =
  blue, Left = red, Center = secondary); "View All Sources" button.
- **Newsletter CTA.** Light `surface` band, `rounded-lg`: bold "Stay Informed. Stay
  Balanced." + subcopy left; email `<input>` + dark Subscribe button right. Visual only.
- **Colors/spacing/type.** Use existing `@theme` tokens and `.text-*` utilities only — no
  new hardcoded hex. Bias colors always from `bias-left`/`bias-center`/`bias-right`.

## Implementation requirements

- TypeScript, explicit prop types, no `any`. Small focused components; no mixed UI/business
  logic. Keep the page handler thin — compose components, no data-shaping beyond the mock
  lookup.
- Preserve server/client boundaries (§21): all presentational Server Components; no
  `"use client"`, no network calls, no secrets, no pipeline state.
- Use design tokens + type utilities, not ad-hoc hex/px where a token exists. Reuse
  `BiasMeter`, `Button`, and the layout components — extend, don't fork.
- Inline SVGs for icons (bookmark, share, ⋯, info, chevron), matching existing
  `article-card`/`top-bar` icon style; no new icon dependency.
- Framing/bias UI must read as **AI-estimated** (§19), not objective fact. Percentages sum
  to 100; framing label matches the strongest segment in the mock data.
- Next 16: `params` is a Promise — `await params`; use `notFound()` for unknown ids. Verify
  against `node_modules/next/dist/docs/` before writing.
- No scraping/analysis/network/secret code anywhere in these components (§21).

## Security requirements

- Pure UI; no secrets, no server-only keys, no network calls, no pipeline state, no browser
  execution of Oxylabs/OpenAI/scraping/analysis. Nothing to expose.

## Acceptance criteria

- `/news/1` renders top bar, header, article header/byline, hero + caption, inline Bias
  Distribution bar, article body, Related Stories grid, the three sidebar analysis cards
  (Bias Analysis, AI Summary, Source Breakdown), newsletter CTA, and footer — visually
  matching the reference.
- Sidebar Bias Analysis shows Overall Bias `{Label} {pct}%`, per-lean rows with
  proportional colored bars, and framing presented as AI-estimated.
- AI Summary lists the bulleted key points with the "AI summaries can make mistakes."
  disclaimer. Source Breakdown lists per-lean counts and the Top Sources / Bias list.
- Bias percentages sum to 100 everywhere they appear; bias colors come only from the bias
  tokens.
- Two-column desktop layout collapses to one column below `lg` with the sidebar stacked;
  no horizontal page overflow at 375px. Related Stories is 2-col on desktop, 1-col mobile,
  capped at 5.
- Home `NewsCard`s and Related-story cards link to `/news/{id}`; unknown ids `notFound()`.
- Existing pages (`/`, `/design-system`) and `article-card.tsx` remain unchanged and still
  build. Light-only, deterministic, Poppins throughout.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new route + components)

## Manual test steps

1. `npm run dev`.
2. Open `http://localhost:3000/` and click the first "Trump Sends Iran…" card — confirm it
   navigates to `/news/1`.
3. On `/news/1`, verify against the reference: breadcrumb, title, byline + action icons,
   hero image with caption/credit, inline Bias Distribution bar (`Left 20% / Center 31% /
   Right 49%`, `12 sources`), article body, Related Stories grid, and the three sidebar
   cards (Bias Analysis with `Right 49%`, AI Summary bullets + disclaimer, Source Breakdown
   with Top Sources list), newsletter band, and footer.
4. Resize to ~1024px and ~768px — confirm the sidebar stacks under the article and Related
   Stories collapses to one column; at ~375px confirm no horizontal overflow.
5. Visit `/news/999` (unknown id) — confirm the Next not-found page renders.
6. Confirm `/` and `/design-system` still render unchanged.
