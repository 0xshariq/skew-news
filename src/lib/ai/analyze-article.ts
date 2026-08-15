import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import type { Article } from "@/lib/supabase/types";
import { analysisSchema, type AnalysisOutput } from "./schema";

/**
 * AI analysis layer (AGENTS.md §19). One `generateObject` call per article using
 * OpenAI (mandated by §6/§21) with the Zod schema forcing structured, validated
 * output. Server-only — never reaches browser code (§21). Retry-once-then-fail
 * is handled by the orchestrator (`lib/pipeline/analyze.ts`); this returns a
 * typed success or failure and never throws.
 */

/** Analysis model. Centralized so §19's `model` field and cost stay in one place. */
export const ANALYSIS_MODEL = "gpt-4o-mini";

/** Cap article text sent to the model to bound tokens/cost on long pages. */
const MAX_TEXT_CHARS = 12_000;

const SYSTEM_PROMPT = [
  "You are a neutral media-analysis assistant for a news transparency product.",
  "Analyze the single article you are given and return structured analysis.",
  "",
  "Rules:",
  "- Write a neutral, factual summary with no opinion or spin.",
  "- Estimate political framing from the ARTICLE TEXT EVIDENCE ONLY.",
  "  Never infer framing from the source name or your prior knowledge of it.",
  "- leftPercentage, centerPercentage and rightPercentage are each 0–100 and",
  "  should together represent the full framing split (aim for a sum of 100).",
  "- politicalFramingLabel must match the strongest percentage, UNLESS confidence",
  "  is low or the percentages are close — then prefer 'mixed' or 'unclear'.",
  "- If evidence is weak, use 'unclear' and keep confidence low.",
  "- loadedTerms are emotionally charged or slanted words actually present in the text.",
  "- The framing is AI-estimated, not objective truth; say so in the disclaimer.",
].join("\n");

/** Result of analyzing one article. Never throws. */
export type AnalyzeArticleResult =
  | { ok: true; output: AnalysisOutput }
  | { ok: false; error: string };

function buildPrompt(article: Article): string {
  const body = article.raw_text.slice(0, MAX_TEXT_CHARS);
  return [
    `TITLE: ${article.title}`,
    `PUBLISHED: ${article.published_at}`,
    "",
    "ARTICLE TEXT:",
    body,
  ].join("\n");
}

/** Run one AI analysis pass. Returns validated output or a typed failure. */
export async function analyzeArticle(
  article: Article,
): Promise<AnalyzeArticleResult> {
  try {
    const { object } = await generateObject({
      model: openai(ANALYSIS_MODEL),
      schema: analysisSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(article),
    });
    return { ok: true, output: object };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown AI error",
    };
  }
}
