/**
 * Typed results for the scrape-to-insert pipeline (AGENTS.md §9/§16/§21).
 * Shared by the manual scraper and (later, §18) the scheduler processor.
 */

/** Why a candidate or detail page was not saved. Keyed for grouped counts. */
export type RejectionReason =
  | "rejected-url" // failed candidate URL check / non-article reject list (§9/§12)
  | "duplicate" // URL/canonical already in Supabase (§9/§10)
  | "fetch-failed" // Oxylabs detail fetch errored or returned non-200
  | "no-title"
  | "generic-title"
  | "no-image"
  | "no-date"
  | "thin-body" // failed the body quality gate (§13)
  | "listing-canonical" // canonical points at a listing/category/product page (§13)
  | "parse-error";

/** Outcome of a single source's pass through the pipeline. */
export interface SourceResult {
  sourceId: string;
  sourceName: string;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  /** Set when the whole source failed early (e.g. homepage fetch error). */
  error?: string;
}

export type ScrapeStatus = "completed" | "failed";

/** Final run summary — returned in the API response and written to `logs` (§9). */
export interface ScrapeSummary {
  status: ScrapeStatus;
  sourcesChecked: number;
  candidatesFound: number;
  candidatesRejected: number;
  duplicatesSkipped: number;
  detailPagesScraped: number;
  articlesInserted: number;
  articlesRejected: number;
  articlesFailed: number;
  durationMs: number;
  /** Rejection reasons grouped by count (§9). */
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  sources: SourceResult[];
}

/** Options for a manual scrape run (§8/§16). */
export interface ScrapeOptions {
  /** Source names or ids to scrape. Omitted/empty → all active sources. */
  sources?: string[];
  /** Valid articles to insert per source. Defaults to DEFAULT_LIMIT_PER_SOURCE. */
  limitPerSource?: number;
}

/** Outcome for a single source during a schedule sync (§18). */
export interface ScheduleSyncResult {
  sourceId: string;
  sourceName: string;
  /** The Oxylabs schedule id now tracked for this source. */
  scheduleId: string;
  /** `created` (new Oxylabs schedule) or `existing` (already tracked, reused). */
  action: "created" | "existing";
}

/** Final summary of a schedule sync run — API response + `logs` (§18). */
export interface ScheduleSyncSummary {
  status: "completed" | "failed";
  sourcesChecked: number;
  schedulesCreated: number;
  schedulesReused: number;
  /** Orphaned Oxylabs schedules deactivated (§18). */
  orphansDeactivated: number;
  durationMs: number;
  schedules: ScheduleSyncResult[];
}

/** Combined result of the automatic cron pipeline (§18): process then analyze. */
export interface CronPipelineSummary {
  status: "completed" | "failed";
  /** Scrape/process step summary, or an error message if it threw. */
  process: ScrapeSummary | { status: "failed"; error: string };
  /** Analysis step summary, or an error message if it threw. */
  analyze: AnalysisSummary | { status: "failed"; error: string };
  durationMs: number;
}

/** Options for an AI analysis run (§19). */
export interface AnalyzeOptions {
  /** Cap total articles analyzed this run. Omitted → all pending. */
  limit?: number;
  /** Analyze only these article ids (still skips ones already analyzed). */
  articleIds?: string[];
}

/** Per-article failure detail for the analysis summary. */
export interface AnalysisFailure {
  articleId: string;
  reason: string;
}

/** Final analysis run summary — returned in the API response and written to `logs` (§19). */
export interface AnalysisSummary {
  status: "completed" | "failed";
  /** Total pending articles considered this run. */
  pending: number;
  /** Successfully analyzed and saved. */
  analyzed: number;
  /** Skipped (e.g. already analyzed by the time it was reached). */
  skipped: number;
  /** Failed after retry — nothing saved. */
  failed: number;
  /** Number of batches processed. */
  batches: number;
  durationMs: number;
  /** Per-article failures for debugging. */
  failures: AnalysisFailure[];
}
