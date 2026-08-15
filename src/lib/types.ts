/** Framing percentages for a story; each 0–100, expected to sum to 100. */
export interface BiasBreakdown {
  left: number;
  center: number;
  right: number;
}

/**
 * Presentational shape for a news card. Mirrors the fields the eventual Supabase
 * query will return (see AGENTS.md §19) so cards stay display-only when the real
 * data layer replaces the mock source.
 */
export interface NewsArticleCard {
  id: string;
  title: string;
  category: string;
  country: string;
  imageUrl: string;
  bias: BiasBreakdown;
  sources: number;

  /**
   * Real per-article fields (AGENTS.md §19), populated from Supabase. Optional so
   * the mock/design-system data (which omits them) still satisfies the shape; the
   * card renders them when present and falls back to category/country/sources.
   */
  source?: string;
  publishedDate?: string;
  sentimentLabel?: SentimentLabel;
  biasLabel?: FramingLabel;
  /** AI confidence 0–1. */
  confidence?: number;
}

/** AI-estimated political framing label (AGENTS.md §19). */
export type FramingLabel = "left" | "center" | "right" | "mixed" | "unclear";

/** Sentiment label derived from the sentiment score (AGENTS.md §19). */
export type SentimentLabel = "positive" | "neutral" | "negative";

/** Per-source political lean shown in the Source Breakdown list. */
export type SourceLean = "left" | "center" | "right";

/** A source contributing to a story's coverage, with its estimated lean. */
export interface SourceRef {
  name: string;
  bias: SourceLean;
}

/**
 * Presentational shape for the full news details page. Mirrors the fields the
 * eventual Supabase query (articles + article_analyses, AGENTS.md §19/§20) will
 * return so the detail components stay display-only when real data replaces the
 * mock source. Framing values are AI-estimated, not objective truth.
 */
export interface NewsArticleDetail {
  id: string;
  title: string;
  category: string;
  country: string;
  author: string;
  /** Display-formatted publish date, e.g. "May 31, 2026". */
  publishedDate: string;
  readTime: string;
  imageUrl: string;
  imageCaption: string;
  imageCredit: string;
  bodyParagraphs: string[];

  /** Framing percentages (each 0–100, sum to 100). */
  bias: BiasBreakdown;
  biasLabel: FramingLabel;
  sentimentLabel: SentimentLabel;
  /** AI confidence 0–1; optional. */
  confidence?: number;
  framingNotes: string;
  loadedTerms: string[];
  disclaimer: string;

  /** AI neutral summary as key points. */
  summaryPoints: string[];
  summaryGenerated: string;
  summaryReadTime: string;

  sourceCount: number;
  topSources: SourceRef[];

  /** Related coverage by similarity (AGENTS.md §20 caps the display at 5). */
  related: NewsArticleCard[];
}
