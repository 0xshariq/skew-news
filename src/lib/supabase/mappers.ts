/**
 * Pure adapters from Supabase rows to the presentational view models in
 * `lib/types.ts`. The schema is one-article-per-source, so fields the mock
 * modelled as a multi-source cluster (source count, top sources) collapse to a
 * single source here (see prompts/supabase-database-and-data-access.md).
 */
import type { ArticleWithRelations } from "@/lib/supabase/queries/articles";
import type {
  BiasBreakdown,
  FramingLabel,
  NewsArticleCard,
  NewsArticleDetail,
  SentimentLabel,
  SourceLean,
} from "@/lib/types";

const WORDS_PER_MINUTE = 200;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Format an ISO timestamp as "MMM D, YYYY" (UTC). */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

/** Split cleaned article text into display paragraphs. */
export function splitParagraphs(raw: string): string[] {
  const byBlocks = raw
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (byBlocks.length > 0) return byBlocks;

  const single = raw.replace(/\s+/g, " ").trim();
  return single ? [single] : [];
}

/** Estimate reading time from word count, floored at 1 minute. */
export function readTimeFromText(raw: string): string {
  const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

/** Turn the neutral summary into bulleted points (by line, else by sentence). */
export function summaryToPoints(summary: string): string[] {
  const byLine = summary
    .split(/\n+/)
    .map((line) => line.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const bySentence = summary
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return bySentence.length > 0 ? bySentence : [summary.trim()].filter(Boolean);
}

/** Collapse the five framing labels onto the three-way source lean. */
export function leanFromLabel(label: FramingLabel): SourceLean {
  if (label === "left") return "left";
  if (label === "right") return "right";
  return "center";
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function biasOf(row: ArticleWithRelations): BiasBreakdown {
  const { left_percentage, center_percentage, right_percentage } = row.analysis;
  return {
    left: left_percentage,
    center: center_percentage,
    right: right_percentage,
  };
}

/** Map a joined article row to a home-grid card view model. */
export function toCardView(row: ArticleWithRelations): NewsArticleCard {
  const sentimentLabel = row.analysis.sentiment_label as SentimentLabel;
  const biasLabel = row.analysis.bias_label as FramingLabel;
  const publishedDate = formatDate(row.published_at);

  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    bias: biasOf(row),
    // Real per-article fields (§19) preferred by the card when present.
    source: row.source.name,
    publishedDate,
    sentimentLabel,
    biasLabel,
    confidence: row.analysis.confidence,
    // Backwards-compatible fallbacks for the shared card shape.
    category: row.source.name,
    country: titleCase(sentimentLabel),
    sources: 1,
  };
}

/** Map a joined article row to the full detail-page view model. */
export function toDetailView(row: ArticleWithRelations): NewsArticleDetail {
  const bias = biasOf(row);
  const biasLabel = row.analysis.bias_label as FramingLabel;
  const sentimentLabel = row.analysis.sentiment_label as SentimentLabel;

  return {
    id: row.id,
    title: row.title,
    category: row.source.name,
    country: titleCase(sentimentLabel),
    author: row.source.name,
    publishedDate: formatDate(row.published_at),
    readTime: readTimeFromText(row.raw_text),
    imageUrl: row.image_url,
    imageCaption: row.title,
    imageCredit: row.source.name,
    bodyParagraphs: splitParagraphs(row.raw_text),

    bias,
    biasLabel,
    sentimentLabel,
    confidence: row.analysis.confidence,
    framingNotes: row.analysis.framing_notes ?? "",
    loadedTerms: row.analysis.loaded_terms,
    disclaimer: row.analysis.disclaimer ?? "",

    summaryPoints: summaryToPoints(row.analysis.summary),
    summaryGenerated: formatDate(row.analyzed_at),
    summaryReadTime: readTimeFromText(row.analysis.summary),

    sourceCount: 1,
    topSources: [{ name: row.source.name, bias: leanFromLabel(biasLabel) }],
    // pgvector Related Articles arrives in §20; empty renders nothing.
    related: [],
  };
}
