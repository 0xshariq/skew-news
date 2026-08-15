import "server-only";

import type { Source } from "@/lib/supabase/types";

/**
 * Candidate URL normalization and filtering (AGENTS.md §9/§11/§12).
 * This module is the single home of the non-article reject list — other layers
 * refer to it here and never re-declare it.
 */

/** Query params that are tracking noise; dropped during normalization. */
const TRACKING_PARAM_PREFIXES = ["utm_", "ref", "cmp", "ito", "at_", "ns_"];
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "spm",
  "cid",
]);

/**
 * Non-article reject list (§9). Matched as whole path segments against the URL.
 * When this list changes, update it here only.
 */
const NON_ARTICLE_PATTERNS: readonly string[] = [
  // category / section / topic / tag
  "category",
  "categories",
  "section",
  "sections",
  "topic",
  "topics",
  "tag",
  "tags",
  // author
  "author",
  "authors",
  "byline",
  "profile",
  "people",
  // search
  "search",
  // navigation / menu / footer
  "menu",
  "sitemap",
  // shows / programs / podcasts
  "show",
  "shows",
  "program",
  "programs",
  "programmes",
  "podcast",
  "podcasts",
  "watch",
  "video",
  "videos",
  // live
  "live",
  "livenews",
  "live-news",
  // games
  "game",
  "games",
  "puzzles",
  "crossword",
  // product / review / shopping
  "product",
  "products",
  "review",
  "reviews",
  "shop",
  "shopping",
  "deals",
  "store",
  // corporate / support
  "about",
  "about-us",
  "contact",
  "careers",
  "jobs",
  "help",
  "support",
  "terms",
  "privacy",
  "legal",
  "advertise",
  "press",
  // newsletter / subscription
  "newsletter",
  "newsletters",
  "subscribe",
  "subscription",
  "account",
  "signin",
  "sign-in",
  "login",
  "register",
] as const;

/** Path segments that are never news article hosts even if same-site. */
const REJECT_HOST_PREFIXES = ["sport", "sports", "weather"];

/**
 * Canonicalize a URL for dedupe/comparison: lowercase host, strip fragment,
 * drop tracking query params, and remove a trailing slash. Returns null for
 * anything unparseable or non-http(s).
 */
export function normalizeUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (
      TRACKING_PARAMS.has(lower) ||
      TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))
    ) {
      url.searchParams.delete(key);
    }
  }

  let out = url.toString();
  // Normalize a bare trailing slash on the path (but keep "https://host/").
  if (out.endsWith("/") && url.pathname !== "/") out = out.slice(0, -1);
  return out;
}

/** Lowercased, non-empty path segments of a URL. */
function segments(url: URL): string[] {
  return url.pathname
    .split("/")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hostOf(source: Source): string {
  try {
    return new URL(source.listing_url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** True when the URL is a homepage / listing / any non-article reject type (§9/§11). */
export function isRejectedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  const segs = segments(parsed);

  // Homepage or near-empty path.
  if (segs.length === 0) return true;

  if (segs.some((s) => REJECT_HOST_PREFIXES.includes(s))) return true;
  if (segs.some((s) => NON_ARTICLE_PATTERNS.includes(s))) return true;

  return false;
}

/** A digit-heavy id or date path is a strong article signal. */
function hasArticleIdSignal(segs: string[]): boolean {
  // Date path e.g. /2026/07/11/... or /2026/jul/11/...
  const months =
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/;
  for (let i = 0; i < segs.length - 1; i++) {
    if (/^(19|20)\d{2}$/.test(segs[i]) && months.test(segs[i + 1])) return true;
    if (/^(19|20)\d{2}$/.test(segs[i]) && /^\d{1,2}$/.test(segs[i + 1])) {
      return true;
    }
  }
  // A long numeric id anywhere (>= 6 digits) or a slug ending in digits.
  const last = segs[segs.length - 1] ?? "";
  if (/\d{6,}/.test(last)) return true;
  if (/-\d{4,}$/.test(last)) return true;
  return false;
}

/** A long multi-word slug (kebab-cased headline) is an article signal. */
function hasSlugSignal(segs: string[]): boolean {
  const last = segs[segs.length - 1] ?? "";
  const words = last.split("-").filter(Boolean);
  return words.length >= 4 && last.length >= 20;
}

/**
 * Keep a candidate only when it looks like a real article detail URL for its
 * source (§12). Same-host, not a reject-list/homepage path, and carrying an
 * article id, a date path, or a long story slug. Uncertain → reject (stricter
 * choice per §12).
 */
export function isLikelyArticleUrl(url: string, source: Source): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = hostOf(source);
  if (host && parsed.hostname !== host) return false;

  if (isRejectedUrl(url)) return false;

  const segs = segments(parsed);
  // Need enough path depth to be a story, not a landing page.
  if (segs.length < 2) return false;

  return hasArticleIdSignal(segs) || hasSlugSignal(segs);
}
