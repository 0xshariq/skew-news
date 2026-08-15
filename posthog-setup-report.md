<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into SKEW. Here is a summary of all changes made:

- **`instrumentation-client.ts`** (new): Initializes `posthog-js` for the browser using Next.js 15.3+ instrumentation. Sets up the EU reverse proxy (`/ingest`), enables exception autocapture, and turns on debug mode in development.
- **`next.config.ts`**: Added reverse proxy rewrites so browser requests go through `/ingest` to `eu.i.posthog.com` and static assets to `eu-assets.i.posthog.com`, avoiding ad blockers. Added `skipTrailingSlashRedirect: true`.
- **`lib/posthog-server.ts`** (new): Server-side PostHog client factory using `posthog-node` with `flushAt: 1` / `flushInterval: 0` to flush synchronously in short-lived serverless handlers.
- **`components/posthog/user-identifier.tsx`** (new): Client component using Clerk's `useUser()` hook. Calls `posthog.identify()` with the Clerk user ID, email, and name when signed in; calls `posthog.reset()` when signed out. Handles returning visitors automatically on every page load.
- **`app/layout.tsx`**: Mounts `<PostHogUserIdentifier />` inside `<ClerkProvider>` so identification runs on every route.
- **`components/ui/news-card.tsx`**: Converted to a client component. Fires `article_clicked` with `article_id`, `article_title`, `source`, `bias_label`, and `sentiment_label` when a user clicks a news card.
- **`components/layout/newsletter-cta.tsx`**: Converted to a client component. Fires `newsletter_subscribe_clicked` when the Subscribe button is clicked.
- **`components/layout/site-header.tsx`**: Converted to a client component. Fires `sign_up_clicked` and `sign_in_clicked` when the respective auth buttons in the header are clicked.
- **`components/posthog/article-view-tracker.tsx`** (new): Client component that fires `article_viewed` on mount with `article_id`, `article_title`, `source`, `bias_label`, and `sentiment_label`. Used as a side-effect-only tracker inside the news detail page.
- **`app/news/[id]/page.tsx`**: Mounts `<ArticleViewTracker>` with the article's metadata to track full article reads.
- **`app/api/scrape/route.ts`**: After a successful scrape, fires `scrape_completed` server-side with status, sources checked, articles inserted, rejected, duplicates skipped, and duration.
- **`app/api/analyze/route.ts`**: After a successful analysis run, fires `analysis_completed` server-side with status, pending count, analyzed, failed, batches, and duration.

| Event | Description | File |
|---|---|---|
| `article_clicked` | User clicked on a news card from the home feed to open the article detail page. | `components/ui/news-card.tsx` |
| `newsletter_subscribe_clicked` | User clicked the Subscribe button in the newsletter call-to-action section. | `components/layout/newsletter-cta.tsx` |
| `sign_in_clicked` | User clicked the Login button in the site header to initiate sign-in. | `components/layout/site-header.tsx` |
| `sign_up_clicked` | User clicked the Subscribe button in the site header to initiate sign-up. | `components/layout/site-header.tsx` |
| `article_viewed` | User loaded a full article detail page with AI analysis — top of the reading funnel. | `app/news/[id]/page.tsx` |
| `scrape_completed` | Manual scrape pipeline finished, capturing articles inserted, duplicates, and duration. | `app/api/scrape/route.ts` |
| `analysis_completed` | AI analysis pipeline finished, capturing articles analyzed, failed, and duration. | `app/api/analyze/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/221603/dashboard/811265)
- [Article clicks over time (wizard)](https://eu.posthog.com/project/221603/insights/VChR2rXA)
- [Article engagement funnel (wizard)](https://eu.posthog.com/project/221603/insights/uABicO03)
- [Article views by bias label (wizard)](https://eu.posthog.com/project/221603/insights/Ei5FYCPu)
- [Newsletter subscribe clicks (wizard)](https://eu.posthog.com/project/221603/insights/E5pzAQpq)
- [Pipeline operations (wizard)](https://eu.posthog.com/project/221603/insights/FbFzFiVr)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any team onboarding scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog Error Tracking.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogUserIdentifier` component handles this on every page load via Clerk's `useUser()`, but verify it works after a hard refresh while already signed in.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
