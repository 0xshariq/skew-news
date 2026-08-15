import "server-only";

import * as cheerio from "cheerio";

import type { Source } from "@/lib/supabase/types";
import { normalizeUrl } from "./candidate-url";

/**
 * Homepage story-card link extraction (AGENTS.md §11).
 * Collect only visible story/article links from the homepage content — never
 * every link — and drop everything living in navigation, menu, footer, or
 * aside/subscription regions. Candidate filtering (§12) happens downstream.
 */

/** Regions whose links are chrome, not story cards. */
const CHROME_SELECTORS = [
  "nav",
  "header",
  "footer",
  "aside",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-label*="navigation" i]',
  ".nav",
  ".navbar",
  ".menu",
  ".footer",
  ".header",
  ".masthead",
  ".subnav",
  ".breadcrumb",
];

/**
 * Extract unique, normalized candidate article links from a source homepage.
 * Links are absolutized against the source homepage URL.
 */
export function extractCandidateLinks(html: string, source: Source): string[] {
  const $ = cheerio.load(html);

  // Remove chrome regions entirely so their links never surface.
  for (const selector of CHROME_SELECTORS) {
    $(selector).remove();
  }

  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const trimmed = href.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("javascript:")
    ) {
      return;
    }

    const normalized = normalizeUrl(trimmed, source.listing_url);
    if (normalized) seen.add(normalized);
  });

  return [...seen];
}
