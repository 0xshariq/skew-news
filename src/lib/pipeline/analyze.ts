import "server-only";

import {
  getPendingArticles,
  getArticlesByIds,
  getAnalyzedArticleIds,
  saveAnalysis,
} from "@/lib/supabase/queries/articles";
import { createLog } from "@/lib/supabase/queries/logs";
import { analyzeArticle, ANALYSIS_MODEL } from "@/lib/ai/analyze-article";
import type { AnalysisOutput } from "@/lib/ai/schema";
import type {
  Article,
  ArticleAnalysisInsert,
  BiasLabelValue,
  Json,
} from "@/lib/supabase/types";
import type {
  AnalysisFailure,
  AnalysisSummary,
  AnalyzeOptions,
} from "./types";

/**
 * AI analysis orchestrator (AGENTS.md §19). Loads pending articles (or targeted
 * ids, still skipping already-analyzed ones), processes them in batches, runs
 * the AI layer with retry-once-then-fail, normalizes and derives fields,
 * validates, and saves append-only. Emits neat console progress plus a final
 * summary object and a `logs` row. Server-only and reusable by the §18 cron
 * route. One bad article never aborts the run.
 */

/** Default articles analyzed per batch (§19). Overridable via env. */
const DEFAULT_BATCH_SIZE = 5;

function batchSize(): number {
  const raw = Number(process.env.ANALYSIS_BATCH_SIZE);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_BATCH_SIZE;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Normalize three raw percentages to non-negative integers summing to exactly
 * 100 (largest-remainder rounding) so the DB `= 100` CHECK never rejects a valid
 * analysis. Falls back to a center split if the model returns all zeros.
 */
function normalizePercentages(
  left: number,
  center: number,
  right: number,
): { left: number; center: number; right: number } {
  const raw = [Math.max(0, left), Math.max(0, center), Math.max(0, right)];
  const total = raw[0] + raw[1] + raw[2];
  if (total === 0) return { left: 0, center: 100, right: 0 };

  const scaled = raw.map((v) => (v / total) * 100);
  const floored = scaled.map((v) => Math.floor(v));
  let remainder = 100 - (floored[0] + floored[1] + floored[2]);

  // Hand out the leftover units to the largest fractional parts first.
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k = (k + 1) % 3, remainder--) {
    floored[order[k].i] += 1;
  }

  return { left: floored[0], center: floored[1], right: floored[2] };
}

/** Round to 3 decimals for the `numeric(4,3)` bias/sentiment/confidence columns. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Turn validated AI output into a DB insert row. Derives `bias_score` in code
 * (§19) and normalizes percentages so the row satisfies every DB CHECK.
 */
function toInsertRow(
  articleId: string,
  output: AnalysisOutput,
): ArticleAnalysisInsert {
  const pct = normalizePercentages(
    output.leftPercentage,
    output.centerPercentage,
    output.rightPercentage,
  );
  const biasScore = round3((pct.right - pct.left) / 100);

  return {
    article_id: articleId,
    summary: output.summary,
    sentiment_score: round3(output.sentimentScore),
    sentiment_label: output.sentimentLabel,
    bias_score: biasScore,
    bias_label: output.politicalFramingLabel as BiasLabelValue,
    left_percentage: pct.left,
    center_percentage: pct.center,
    right_percentage: pct.right,
    confidence: round3(output.confidence),
    framing_notes: output.framingNotes,
    loaded_terms: output.loadedTerms,
    disclaimer: output.disclaimer,
    model: ANALYSIS_MODEL,
  };
}

/** Resolve the articles to analyze for this run (§19 default vs targeted). */
async function selectArticles(options: AnalyzeOptions): Promise<Article[]> {
  if (options.articleIds && options.articleIds.length > 0) {
    const articles = await getArticlesByIds(options.articleIds);
    const analyzed = await getAnalyzedArticleIds(articles.map((a) => a.id));
    const pending = articles.filter((a) => !analyzed.has(a.id));
    return options.limit && options.limit > 0
      ? pending.slice(0, options.limit)
      : pending;
  }
  return getPendingArticles(options.limit);
}

/** Analyze one article with retry-once-then-fail. Returns the insert row or null. */
async function analyzeOne(
  article: Article,
): Promise<ArticleAnalysisInsert | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await analyzeArticle(article);
    if (result.ok) return toInsertRow(article.id, result.output);
    console.warn(
      `[analyze] article ${article.id} attempt ${attempt} failed: ${result.error}`,
    );
  }
  return null;
}

/** Run AI analysis and return the summary (§19). */
export async function runAnalysis(
  options: AnalyzeOptions = {},
  startedAtMs: number = Date.now(),
): Promise<AnalysisSummary> {
  console.info("[analyze] run started");

  const articles = await selectArticles(options);
  console.info(`[analyze] ${articles.length} pending article(s) to analyze`);

  let analyzed = 0;
  let failed = 0;
  const failures: AnalysisFailure[] = [];
  const batches = chunk(articles, batchSize());

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.info(
      `[analyze] batch ${b + 1}/${batches.length} (${batch.length} article(s))`,
    );

    for (const article of batch) {
      const row = await analyzeOne(article);
      if (!row) {
        failed += 1;
        failures.push({ articleId: article.id, reason: "invalid AI output after retry" });
        continue;
      }
      try {
        await saveAnalysis(article.id, row);
        analyzed += 1;
        console.info(`[analyze] saved analysis for ${article.id}`);
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "save failed";
        failures.push({ articleId: article.id, reason });
        console.error(`[analyze] save failed for ${article.id}: ${reason}`);
      }
    }

    console.info(
      `[analyze] batch ${b + 1} done — ${analyzed} analyzed, ${failed} failed so far`,
    );
  }

  const durationMs = Date.now() - startedAtMs;
  const summary: AnalysisSummary = {
    status: "completed",
    pending: articles.length,
    analyzed,
    skipped: 0,
    failed,
    batches: batches.length,
    durationMs,
    failures,
  };

  console.info("[analyze] run completed", summary);
  await createLog({
    level: failed > 0 ? "warn" : "info",
    event: "analyze.summary",
    message: `Analysis: ${analyzed} analyzed, ${failed} failed of ${articles.length} pending`,
    context: summary as unknown as Json,
  });

  return summary;
}
