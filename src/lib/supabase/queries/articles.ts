import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type {
  Article,
  ArticleAnalysis,
  ArticleAnalysisInsert,
  ArticleInsert,
  Source,
} from "@/lib/supabase/types";

/** Max URLs per PostgREST `.in()` filter — never exceed (AGENTS.md §9). */
export const MAX_URLS_PER_IN_QUERY = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * URL existence check (AGENTS.md §9). Returns the subset of the given URLs that
 * already exist in Supabase, matched against both `url` and `canonical_url` so
 * dedupe honors §10. Queries in chunks of ≤15 — never passes more than that to
 * a single `.in()` filter.
 */
export async function articleUrlsExist(
  urls: string[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  const unique = [...new Set(urls)];
  if (unique.length === 0) return existing;

  const supabase = createServiceClient();

  for (const group of chunk(unique, MAX_URLS_PER_IN_QUERY)) {
    const [byUrl, byCanonical] = await Promise.all([
      supabase.from("articles").select("url").in("url", group),
      supabase.from("articles").select("canonical_url").in("canonical_url", group),
    ]);

    if (byUrl.error) {
      throw new Error(`URL existence check failed: ${byUrl.error.message}`);
    }
    if (byCanonical.error) {
      throw new Error(
        `Canonical existence check failed: ${byCanonical.error.message}`,
      );
    }

    for (const row of byUrl.data ?? []) existing.add(row.url);
    for (const row of byCanonical.data ?? []) {
      if (row.canonical_url) existing.add(row.canonical_url);
    }
  }

  return existing;
}

/** Result of an append-only article insert. */
export type InsertArticleResult =
  | { status: "inserted"; id: string }
  | { status: "duplicate" };

/**
 * Insert one article, append-only (AGENTS.md §10). A unique-violation on `url`
 * (Postgres 23505) is reported as a duplicate rather than throwing — the DB is
 * the final dedupe guard. Existing rows are never updated or deleted.
 */
export async function insertArticle(
  row: ArticleInsert,
): Promise<InsertArticleResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("articles")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { status: "duplicate" };
    throw new Error(`Failed to insert article ${row.url}: ${error.message}`);
  }

  return { status: "inserted", id: data.id };
}

/**
 * Articles pending AI analysis (AGENTS.md §19.1). An article is pending when NO
 * `article_analyses` row exists for it — LEFT JOIN semantics, never
 * `analyzed_at IS NULL` alone (an article can have `analyzed_at` set while its
 * analysis row was deleted). We embed only the analysis id, then filter in JS to
 * rows with an empty embed — avoiding the §21 joined-column-filter gotcha.
 * Newest first; `limit` caps the number returned.
 */
export async function getPendingArticles(limit?: number): Promise<Article[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("articles")
    .select("*, article_analyses(id)")
    .order("published_at", { ascending: false });

  // Over-fetch when limiting, since some rows are dropped by the JS filter.
  if (limit && limit > 0) query = query.limit(limit * 3);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load pending articles: ${error.message}`);
  }

  type Row = Article & { article_analyses: { id: string }[] | { id: string } | null };
  const pending = (data ?? [])
    .filter((row) => {
      const analysis = (row as Row).article_analyses;
      const arr = Array.isArray(analysis) ? analysis : analysis ? [analysis] : [];
      return arr.length === 0;
    })
    .map((row) => {
      // Strip the embedded relation; callers want a plain Article.
      const copy = { ...(row as Row) } as Partial<Row>;
      delete copy.article_analyses;
      return copy as Article;
    });

  return limit && limit > 0 ? pending.slice(0, limit) : pending;
}

/** Fetch specific articles by id (for targeted analysis runs, §19). */
export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const supabase = createServiceClient();
  const out: Article[] = [];

  for (const group of chunk(unique, MAX_URLS_PER_IN_QUERY)) {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .in("id", group);
    if (error) {
      throw new Error(`Failed to load articles by id: ${error.message}`);
    }
    out.push(...(data ?? []));
  }

  return out;
}

/**
 * Save one article's analysis append-only (AGENTS.md §19). Inserts the
 * `article_analyses` row, then sets `analyzed_at` ONLY after the insert
 * succeeds. Service role. Throws on failure so the caller can count it as failed.
 */
export async function getAnalyzedArticleIds(
  ids: string[],
): Promise<Set<string>> {
  const analyzed = new Set<string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return analyzed;

  const supabase = createServiceClient();

  for (const group of chunk(unique, MAX_URLS_PER_IN_QUERY)) {
    const { data, error } = await supabase
      .from("article_analyses")
      .select("article_id")
      .in("article_id", group);
    if (error) {
      throw new Error(`Failed to check analyzed ids: ${error.message}`);
    }
    for (const row of data ?? []) analyzed.add(row.article_id);
  }

  return analyzed;
}

/**
 * Save one article's analysis append-only (section 19). Inserts the
 * `article_analyses` row, then sets `analyzed_at` ONLY after the insert
 * succeeds. Service role. Throws on failure so the caller can count it as failed.
 */
export async function saveAnalysis(
  articleId: string,
  analysis: ArticleAnalysisInsert,
): Promise<void> {
  const supabase = createServiceClient();

  const { error: insertError } = await supabase
    .from("article_analyses")
    .insert(analysis);
  if (insertError) {
    throw new Error(
      `Failed to insert analysis for ${articleId}: ${insertError.message}`,
    );
  }

  const { error: updateError } = await supabase
    .from("articles")
    .update({ analyzed_at: new Date().toISOString() })
    .eq("id", articleId);
  if (updateError) {
    throw new Error(
      `Analysis saved but failed to set analyzed_at for ${articleId}: ${updateError.message}`,
    );
  }
}

/** An article joined with its source and (single) AI analysis. */
export interface ArticleWithRelations extends Article {
  source: Source;
  analysis: ArticleAnalysis;
}

const SELECT = "*, sources(*), article_analyses(*)";

/**
 * PostgREST returns embedded relations as either an object or a single-element
 * array depending on how it detects the relationship. Normalize to one row.
 */
function firstOf<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type RawRow = Article & {
  sources: Source | Source[] | null;
  article_analyses: ArticleAnalysis | ArticleAnalysis[] | null;
};

function shape(row: RawRow): ArticleWithRelations | null {
  const source = firstOf(row.sources);
  const analysis = firstOf(row.article_analyses);
  if (!source || !analysis) return null;

  return { ...row, source, analysis };
}

/**
 * Analyzed articles for the home feed, newest first. Only articles that have an
 * `article_analyses` row and a set `analyzed_at` are returned (§18/§19), so
 * unanalyzed articles never surface. Uses the `!inner` embed hint rather than a
 * joined-column filter (AGENTS.md §21 gotcha).
 */
export async function getHomeArticles(): Promise<ArticleWithRelations[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*, sources(*), article_analyses!inner(*)")
    .not("analyzed_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load home articles: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => shape(row as unknown as RawRow))
    .filter((row): row is ArticleWithRelations => row !== null);
}

/**
 * A single analyzed article by id, with its source and analysis. Returns null
 * when the article does not exist or has no analysis yet (detail route → 404).
 */
export async function getArticleDetailById(
  id: string,
): Promise<ArticleWithRelations | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("articles")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load article ${id}: ${error.message}`);
  }
  if (!data) return null;

  return shape(data as unknown as RawRow);
}
