import "server-only";

import { getActiveSources } from "@/lib/supabase/queries/sources";
import {
  articleUrlsExist,
  insertArticle,
} from "@/lib/supabase/queries/articles";
import { createLog } from "@/lib/supabase/queries/logs";
import type { ArticleInsert, Json, Source } from "@/lib/supabase/types";
import { fetchHtml } from "@/lib/scraping/oxylabs";
import { extractCandidateLinks } from "@/lib/scraping/extract";
import { isLikelyArticleUrl } from "@/lib/scraping/candidate-url";
import { parseArticle } from "@/lib/scraping/article";
import type {
  RejectionReason,
  ScrapeOptions,
  ScrapeSummary,
  SourceResult,
} from "./types";

/**
 * Manual scrape-to-insert pipeline (AGENTS.md §9/§16). Loads selected active
 * sources, fetches each homepage live through Oxylabs, extracts and filters
 * candidate links, dedupes against Supabase, scrapes and validates detail
 * pages, and inserts only valid articles append-only. Emits run logging and
 * returns a summary object. The per-source pipeline is exported so the §18
 * scheduler can reuse it with pre-fetched homepage HTML.
 */

/** Default valid articles inserted per source (§16). */
export const DEFAULT_LIMIT_PER_SOURCE = 5;
/**
 * Detail pages scraped per source is capped well above the target so rejects
 * don't starve the limit, but the run stops once the limit is inserted.
 */
const CANDIDATE_MULTIPLIER = 4;
const MIN_CANDIDATE_CAP = 15;

/** Resolve the sources to scrape from the request selection (§8). */
async function selectSources(selection?: string[]): Promise<Source[]> {
  const active = await getActiveSources();
  if (!selection || selection.length === 0) return active;

  const wanted = new Set(selection.map((s) => s.trim().toLowerCase()));
  return active.filter(
    (s) => wanted.has(s.id.toLowerCase()) || wanted.has(s.name.toLowerCase()),
  );
}

/** Zeroed per-source result. Exported for reuse by the §18 scheduler processor. */
export function emptyResult(source: Source): SourceResult {
  return {
    sourceId: source.id,
    sourceName: source.name,
    candidatesFound: 0,
    candidatesRejected: 0,
    duplicatesSkipped: 0,
    detailPagesScraped: 0,
    articlesInserted: 0,
    articlesRejected: 0,
    articlesFailed: 0,
  };
}

function bump(
  reasons: Partial<Record<RejectionReason, number>>,
  reason: RejectionReason,
): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

/**
 * Run the shared pipeline for a single source given its homepage HTML. Used by
 * manual scraping (live homepage) and, later, the scheduler (§18, job-result
 * homepage). Mutates `result` and `reasons` in place; returns nothing.
 */
export async function processSourceHtml(
  source: Source,
  homepageHtml: string,
  limitPerSource: number,
  result: SourceResult,
  reasons: Partial<Record<RejectionReason, number>>,
): Promise<void> {
  // 1. Extract + filter candidate links (§11/§12).
  const links = extractCandidateLinks(homepageHtml, source);
  const candidates = links.filter((url) => isLikelyArticleUrl(url, source));
  result.candidatesFound = candidates.length;
  result.candidatesRejected = links.length - candidates.length;
  console.info(
    `[scrape] ${source.name}: ${links.length} links → ${candidates.length} candidates ` +
      `(${result.candidatesRejected} rejected pre-detail)`,
  );

  // 2. Dedupe against Supabase (§9 URL existence check).
  const existing = await articleUrlsExist(candidates);
  const fresh = candidates.filter((url) => !existing.has(url));
  result.duplicatesSkipped = candidates.length - fresh.length;
  if (result.duplicatesSkipped > 0) {
    console.info(
      `[scrape] ${source.name}: ${result.duplicatesSkipped} duplicates skipped`,
    );
  }

  // 3. Scrape + validate detail pages until the per-source limit is inserted.
  const cap = Math.max(
    MIN_CANDIDATE_CAP,
    limitPerSource * CANDIDATE_MULTIPLIER,
  );
  let scraped = 0;

  for (const url of fresh) {
    if (result.articlesInserted >= limitPerSource) break;
    if (scraped >= cap) break;
    scraped += 1;

    let html: string;
    try {
      const fetched = await fetchHtml(url);
      html = fetched.html;
      result.detailPagesScraped += 1;
    } catch (err) {
      result.articlesFailed += 1;
      bump(reasons, "fetch-failed");
      console.warn(
        `[scrape] ${source.name}: detail fetch failed for ${url} — ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
      continue;
    }

    const parsed = parseArticle(html);
    if (!parsed.ok) {
      result.articlesRejected += 1;
      bump(reasons, parsed.reason);
      console.info(
        `[scrape] ${source.name}: rejected ${url} (${parsed.reason})`,
      );
      continue;
    }

    const row: ArticleInsert = {
      source_id: source.id,
      url,
      canonical_url: parsed.article.canonicalUrl,
      title: parsed.article.title,
      image_url: parsed.article.imageUrl,
      published_at: parsed.article.publishedAt,
      raw_text: parsed.article.rawText,
      analyzed_at: null,
    };

    try {
      const inserted = await insertArticle(row);
      if (inserted.status === "duplicate") {
        result.duplicatesSkipped += 1;
        bump(reasons, "duplicate");
        console.info(`[scrape] ${source.name}: duplicate on insert ${url}`);
      } else {
        result.articlesInserted += 1;
        console.info(`[scrape] ${source.name}: inserted ${url}`);
      }
    } catch (err) {
      result.articlesFailed += 1;
      console.error(
        `[scrape] ${source.name}: insert failed for ${url} — ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }
}

/** Roll per-source results into a run summary. Exported for the §18 scheduler. */
export function aggregate(
  sources: SourceResult[],
  status: ScrapeSummary["status"],
  durationMs: number,
  rejectionReasons: Partial<Record<RejectionReason, number>>,
): ScrapeSummary {
  const sum = (pick: (r: SourceResult) => number) =>
    sources.reduce((total, r) => total + pick(r), 0);

  return {
    status,
    sourcesChecked: sources.length,
    candidatesFound: sum((r) => r.candidatesFound),
    candidatesRejected: sum((r) => r.candidatesRejected),
    duplicatesSkipped: sum((r) => r.duplicatesSkipped),
    detailPagesScraped: sum((r) => r.detailPagesScraped),
    articlesInserted: sum((r) => r.articlesInserted),
    articlesRejected: sum((r) => r.articlesRejected),
    articlesFailed: sum((r) => r.articlesFailed),
    durationMs,
    rejectionReasons,
    sources,
  };
}

/** Run a full manual scrape and return the summary (§16). */
export async function runManualScrape(
  options: ScrapeOptions = {},
  startedAtMs: number = Date.now(),
): Promise<ScrapeSummary> {
  const limitPerSource =
    options.limitPerSource && options.limitPerSource > 0
      ? options.limitPerSource
      : DEFAULT_LIMIT_PER_SOURCE;

  console.info("[scrape] manual scrape started");
  const sources = await selectSources(options.sources);
  console.info(
    `[scrape] selected ${sources.length} source(s): ` +
      `${sources.map((s) => s.name).join(", ") || "(none)"} · limit ${limitPerSource}/source`,
  );

  const results: SourceResult[] = [];
  const reasons: Partial<Record<RejectionReason, number>> = {};

  for (const source of sources) {
    const result = emptyResult(source);
    console.info(`[scrape] ${source.name}: fetching homepage ${source.listing_url}`);
    try {
      const { html } = await fetchHtml(source.listing_url);
      console.info(`[scrape] ${source.name}: homepage fetched`);
      await processSourceHtml(source, html, limitPerSource, result, reasons);
    } catch (err) {
      result.error = err instanceof Error ? err.message : "unknown error";
      console.error(
        `[scrape] ${source.name}: source failed — ${result.error}`,
      );
    }
    results.push(result);
  }

  const durationMs = Date.now() - startedAtMs;
  const summary = aggregate(results, "completed", durationMs, reasons);

  console.info("[scrape] manual scrape completed", summary);
  await createLog({
    level: "info",
    event: "scrape.summary",
    message: `Manual scrape: ${summary.articlesInserted} inserted, ${summary.duplicatesSkipped} duplicates, ${summary.articlesRejected} rejected across ${summary.sourcesChecked} source(s)`,
    context: summary as unknown as Json,
  });

  return summary;
}
