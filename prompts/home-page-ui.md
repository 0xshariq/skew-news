# Prompt: Home Page UI (SKEW)

## Goal

Build the SKEW **home page** at `app/page.tsx` to match the attached reference: a
utility top bar, a sticky site header with logo + primary nav + auth buttons, a
horizontally-scrollable category chip row, a "Top News" section, and a responsive
3-column grid of vertical news cards. Display-only. No scraping, no analysis, no
pipeline mutation, no live Supabase reads yet (data layer not built) — render from
typed mock data so the layout can be validated pixel-close now and swapped to real
Supabase queries later without touching the presentational components.

## Skills read

- `AGENTS.md` — §1 (build list: home page with news cards), §5 (architecture layers —
  UI displays data only, no scrape/analyze/mutate), §19 (article-card required fields),
  §21 (standards, server/client boundaries), §22 (checks).
- No feature skill applies (clerk/supabase/oxylabs/ai-sdk out of scope for pure UI).
  Per §3, Tailwind/shadcn-style work uses existing project patterns + `@theme` tokens.
- `prompts/design-system.md` — the established token + primitive foundation this builds on.

## Existing code inspected

- `app/globals.css` — Tailwind v4 `@theme` tokens: colors (`text-primary`, `text-secondary`,
  `surface`, `bg-primary`, `bg-secondary`, `border`, `divider`, `bias-left/center/right`,
  `accent`), radius, shadow, `--container-app: 1280px`, and `.text-h1…caption` type utils.
- `app/layout.tsx` — Poppins via `next/font/google`, light-only, `<body class="min-h-full flex flex-col">`.
- `app/page.tsx` — current placeholder branded screen (to be replaced).
- `components/ui/` — `button.tsx` (primary/secondary/outline/text), `chip.tsx` (label + `addable` `+`),
  `bias-meter.tsx` (`{left, center, right}`, optional `showScale`; labels "Left/Center/Right N%"),
  `badge.tsx`, `article-card.tsx` (HORIZONTAL layout — not what the home grid uses).
- `lib/utils.ts` — `cn()`. `package.json` — Next 16.2.10, React 19, Tailwind v4, clsx + tailwind-merge.

## Decisions / assumptions

- **Vertical card, new component.** The reference cards are image-on-top / content-below,
  unlike the existing horizontal `article-card`. Add `components/ui/news-card.tsx` rather than
  overloading `article-card`. Keep `article-card` untouched (design-system still uses it).
- **Mock data, typed.** No Supabase yet, so add `lib/mock/news.ts` exporting a typed
  `MOCK_ARTICLES` array shaped like the eventual query result (fields from §19: title, source,
  country, image, category, publish info, sentiment/framing left/center/right, sources count).
  When real queries land, only the page's data source changes — cards stay presentational.
- **Bias meter label format.** Reference shows the left segment as `L 20%` (short) while
  center/right read `Center 31%` / `Right 49%`, and a very small left segment collapses to just
  `10%`. Add an optional `variant="compact"` (or `shortLeftLabel`) to `bias-meter.tsx` so the
  card uses the short `L` form without changing the design-system's existing full-label usage.
  Segments below a width threshold show percentage only (no clipped word). Do NOT rewrite the
  default behavior — extend it additively.
- **Header interactivity is presentational.** Theme toggle (Light/Dark/Auto), Set Location,
  edition dropdown, Subscribe, and Login are static/visual only — Clerk is not wired yet and
  the app is light-only per the design system. Login/Subscribe render as buttons with no auth
  behavior (wired in the later Clerk task). Nav links point to `/` for now (only Home exists).
- **Server Components by default.** Page and cards are static Server Components. Add
  `"use client"` ONLY to the smallest piece that needs it — the category chip row if it needs
  scroll affordances (otherwise plain CSS overflow-x, no client needed). Prefer no client.

## Files likely to change / add

- `app/page.tsx` — replace placeholder with the full home layout (top bar, header, chip row,
  Top News heading, card grid). Composes the sections below.
- `components/layout/top-bar.tsx` — dark utility bar: Browser Extension · Theme toggle (left);
  date · Set Location · Edition dropdown (right).
- `components/layout/site-header.tsx` — hamburger, "Skew News" wordmark, nav (Home active /
  For You (dot) / Local / Blindspot), Subscribe (primary) + Login (secondary/outline).
- `components/layout/category-bar.tsx` — horizontally scrollable row of `Chip` (addable),
  leading `+`, `overflow-x-auto` with hidden scrollbar; no page horizontal overflow.
- `components/layout/site-footer.tsx` — dark footer: Skew News mark + tagline, Company / Help
  columns, Connect social icons, copyright. (Reference shows it; include for completeness.)
- `components/ui/news-card.tsx` — vertical card: 16:9 image with info icon top-right,
  `category · country` caption, title (`text-h3`/tighter), compact bias meter, `N sources` footer.
- `components/ui/bias-meter.tsx` — add additive compact/short-left option (see decisions).
- `lib/mock/news.ts` — typed `MOCK_ARTICLES` (12 items mirroring the reference).
- Possibly `lib/types.ts` — a shared `NewsArticleCard` type used by mock + card props.

## Visual interpretation (from reference)

- **Top bar:** full-width, near-black bg, `text-caption` light-gray text, ~40px tall. Left:
  "Browser Extension", then "Theme:" with Light (active/bold) · Dark · Auto. Right: full date,
  "Set Location", globe + "International Edition" + chevron. Divider dots between right items.
- **Header:** white, ~72px, bottom border. Left cluster: hamburger icon, then "Skew" (bold,
  ~`text-h2`) + "News" (secondary, smaller, baseline-aligned). Center nav: Home (active —
  bold + underline), For You (with small accent dot super), Local, Blindspot — `text-body-md`.
  Right: Subscribe (primary dark) + Login (outline/secondary), rounded-md.
- **Category bar:** thin white strip under header, bottom border. Chips are pill outline with a
  trailing `+`, `text-body-sm`, ~8px gap, horizontally scrollable, faint `+` at far left and a
  chevron affordance at the right edge.
- **Top News:** `text-h2`/`text-h1`-ish bold heading, generous top margin, left-aligned to the
  1280px container.
- **Card grid:** 3 columns desktop (24px gutter), 2 columns tablet, 1 column mobile. Each card:
  white, `rounded-lg`, `border`, subtle shadow, `p`-4. Image 16:9 `rounded-md`, circular info
  icon top-right over image. Below: `Category · Country` caption (secondary), 2-line title,
  full-width bias meter (L/Center/Right), then `N sources` in secondary caption.
- **Footer:** near-black, multi-column, light text, social icons row.
- **Colors/spacing/type:** use existing `@theme` tokens and `.text-*` utilities only — no new
  hardcoded hex. Container `max-w-[--container-app]` centered with 24px side padding.

## Implementation requirements

- TypeScript, explicit prop types, no `any`. Small focused components; no mixed UI/business logic.
- Preserve server/client boundaries (§21): presentational components, Server Components by default.
- Use design tokens + type utilities, not ad-hoc hex/px where a token exists.
- Reuse existing primitives (`Button`, `Chip`, `BiasMeter`) — extend, don't fork.
- Inline SVGs for icons (match existing `article-card` icon style); no new icon dependency.
- No scraping/analysis/network/secret code anywhere in these components (§21).

## Security requirements

- Pure UI; no secrets, no server-only keys, no network calls, no pipeline state. Nothing to expose.

## Acceptance criteria

- `/` renders top bar, header, category bar, "Top News", a 12-card responsive grid, and footer,
  visually matching the reference.
- Cards show image + info icon, `category · country`, title, L/Center/Right bias meter with
  percentages summing to 100, and `N sources`.
- Grid is 3-col ≥1024px, 2-col ≥640px, 1-col below; no horizontal page overflow at 375px.
- Category row scrolls horizontally without pushing page width.
- `article-card.tsx` and the design-system page remain unchanged and still build.
- Light-only, deterministic; Poppins throughout.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (new routes/components)

## Manual test steps

1. `npm run dev`.
2. Open `http://localhost:3000/` — verify top bar, header/nav, category chips, Top News heading,
   the 12-card grid, and footer against the reference image.
3. Resize to ~1024px (2–3 col), ~768px (2 col), ~375px (1 col) — confirm no horizontal overflow
   and the category row scrolls rather than widening the page.
4. Confirm bias meters render proportional L/Center/Right segments with correct percentages and
   `N sources` under each card.
5. Confirm `/design-system` still renders unchanged.
