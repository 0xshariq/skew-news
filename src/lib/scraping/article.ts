import "server-only";

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

import type { RejectionReason } from "@/lib/pipeline/types";
import { isRejectedUrl } from "./candidate-url";

/**
 * Article detail parsing, the content gate, and raw_text cleanup
 * (AGENTS.md §13). A page is accepted only if it has an article-specific title,
 * an image URL, a published date, and a body that reads like one article.
 */

/** Minimum cleaned body length when paragraph count is low (§13). */
const MIN_BODY_CHARS = 900;
/** Paragraph count that passes regardless of total length (§13). */
const MIN_PARAGRAPHS = 3;
/** A paragraph shorter than this is noise, not article prose. */
const MIN_PARAGRAPH_CHARS = 40;

export interface ParsedArticle {
  title: string;
  imageUrl: string;
  publishedAt: string; // ISO string
  canonicalUrl: string | null;
  rawText: string;
}

export type ParseResult =
  | { ok: true; article: ParsedArticle }
  | { ok: false; reason: RejectionReason };

/** Titles that signal a landing/section page rather than a story (§13). */
const GENERIC_TITLE_PATTERNS = [
  /^home$/i,
  /^homepage$/i,
  /^latest news$/i,
  /^breaking news$/i,
  /^top stories$/i,
  /^news$/i,
  /^video$/i,
  /^live$/i,
  /^watch/i,
  /^shows?$/i,
  /^programmes?$/i,
  /^podcasts?$/i,
  /^search/i,
  /^sign in$/i,
  /^subscribe/i,
  /page not found/i,
  /404/,
];

/** Selectors removed before extracting body text (§13). */
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "figure figcaption",
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  ".ad",
  ".ads",
  ".advert",
  ".advertisement",
  '[class*="ad-"]',
  '[id*="ad-"]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[class*="subscription" i]',
  '[class*="related" i]',
  '[class*="most-read" i]',
  '[class*="most-viewed" i]',
  '[class*="most-popular" i]',
  '[class*="recommend" i]',
  '[class*="share" i]',
  '[class*="social" i]',
  '[class*="promo" i]',
  '[class*="breadcrumb" i]',
  '[class*="caption" i]',
  '[data-testid*="ad" i]',
];

/** Container selectors most likely to hold the article body, best-first. */
const BODY_CONTAINER_SELECTORS = [
  "article",
  '[data-component="text-block"]',
  '[itemprop="articleBody"]',
  ".article-body",
  ".article__body",
  ".story-body",
  ".storytext",
  ".c-article-content",
  '[class*="article-body" i]',
  '[class*="ArticleBody" i]',
  "main",
];

function firstMeta($: CheerioAPI, names: string[]): string | null {
  for (const name of names) {
    const byProp = $(`meta[property="${name}"]`).attr("content");
    if (byProp?.trim()) return byProp.trim();
    const byName = $(`meta[name="${name}"]`).attr("content");
    if (byName?.trim()) return byName.trim();
  }
  return null;
}

function extractTitle($: CheerioAPI): string | null {
  const og = firstMeta($, ["og:title", "twitter:title"]);
  if (og) return og;
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;
  const title = $("title").first().text().trim();
  return title || null;
}

function extractImage($: CheerioAPI): string | null {
  const meta = firstMeta($, ["og:image", "og:image:url", "twitter:image"]);
  if (meta) return meta;
  const linkImage = $('link[rel="image_src"]').attr("href");
  if (linkImage?.trim()) return linkImage.trim();
  return null;
}

function extractFromJsonLd(
  $: CheerioAPI,
): { datePublished?: string; image?: string } {
  const out: { datePublished?: string; image?: string } = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const graph = (node as { "@graph"?: unknown })["@graph"];
        const candidates = Array.isArray(graph) ? graph : [node];
        for (const c of candidates) {
          if (!c || typeof c !== "object") continue;
          const rec = c as Record<string, unknown>;
          if (!out.datePublished && typeof rec.datePublished === "string") {
            out.datePublished = rec.datePublished;
          }
          if (!out.image) {
            const img = rec.image;
            if (typeof img === "string") out.image = img;
            else if (Array.isArray(img) && typeof img[0] === "string") {
              out.image = img[0];
            } else if (
              img &&
              typeof img === "object" &&
              typeof (img as Record<string, unknown>).url === "string"
            ) {
              out.image = (img as Record<string, string>).url;
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });
  return out;
}

function extractPublishedAt($: CheerioAPI, jsonLdDate?: string): string | null {
  const meta = firstMeta($, [
    "article:published_time",
    "og:article:published_time",
    "publishdate",
    "publish-date",
    "date",
    "pubdate",
    "dc.date.issued",
  ]);
  const timeAttr = $("time[datetime]").first().attr("datetime");
  const raw = meta ?? jsonLdDate ?? timeAttr ?? null;
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function extractCanonical($: CheerioAPI): string | null {
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical?.trim()) return canonical.trim();
  return firstMeta($, ["og:url"]);
}

function isGenericTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 15) return true;
  return GENERIC_TITLE_PATTERNS.some((re) => re.test(trimmed));
}

/** Strip boilerplate lines a paragraph should never be (§13). */
const BOILERPLATE_LINE = [
  /^(sign up|subscribe|newsletter|advertisement|sponsored)/i,
  /^(read more|load more|show more|see all|related|most (read|viewed|popular))/i,
  /^(share this|follow us|copyright|all rights reserved)/i,
  /^\W*$/, // punctuation/symbol-only
  /\{[^}]*\}|@media|font-family|px;|rgba?\(/i, // CSS/JS dumps
];

function isBoilerplate(line: string): boolean {
  return BOILERPLATE_LINE.some((re) => re.test(line));
}

/**
 * Collect cleaned article paragraphs. Prefers real <p> blocks inside a body
 * container; if that yields a single blob, splits it on sentence boundaries so
 * the §13 "don't reject on one paragraph" rule holds.
 */
function extractParagraphs($: CheerioAPI): string[] {
  for (const sel of NOISE_SELECTORS) $(sel).remove();

  let container: cheerio.Cheerio<never> | null = null;
  for (const sel of BODY_CONTAINER_SELECTORS) {
    const found = $(sel).first();
    if (found.length && found.find("p").length > 0) {
      container = found as unknown as cheerio.Cheerio<never>;
      break;
    }
  }
  const scope = container ?? $("body");

  const paragraphs: string[] = [];
  scope.find("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length >= MIN_PARAGRAPH_CHARS && !isBoilerplate(text)) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length >= 1) return paragraphs;

  // Fallback: one big blob → split into sentences, then regroup.
  const blob = scope.text().replace(/\s+/g, " ").trim();
  if (!blob) return [];
  const sentences = blob
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_PARAGRAPH_CHARS && !isBoilerplate(s));
  return sentences;
}

/** Parse and validate an article detail page against the content gate (§13). */
export function parseArticle(html: string): ParseResult {
  let $: CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return { ok: false, reason: "parse-error" };
  }

  const title = extractTitle($);
  if (!title) return { ok: false, reason: "no-title" };
  if (isGenericTitle(title)) return { ok: false, reason: "generic-title" };

  const jsonLd = extractFromJsonLd($);

  const imageUrl = extractImage($) ?? jsonLd.image ?? null;
  if (!imageUrl) return { ok: false, reason: "no-image" };

  const publishedAt = extractPublishedAt($, jsonLd.datePublished);
  if (!publishedAt) return { ok: false, reason: "no-date" };

  const canonicalUrl = extractCanonical($);
  if (canonicalUrl && isRejectedUrl(canonicalUrl)) {
    return { ok: false, reason: "listing-canonical" };
  }

  const paragraphs = extractParagraphs($);
  const rawText = paragraphs.join("\n\n");
  const cleanedLength = rawText.replace(/\s+/g, " ").trim().length;

  const passesBody =
    paragraphs.length >= MIN_PARAGRAPHS || cleanedLength >= MIN_BODY_CHARS;
  if (!passesBody) return { ok: false, reason: "thin-body" };

  return {
    ok: true,
    article: {
      title: title.trim(),
      imageUrl,
      publishedAt,
      canonicalUrl: canonicalUrl ?? null,
      rawText,
    },
  };
}
