import { z } from "zod";

/**
 * Zod schema for the raw AI analysis output (AGENTS.md §19). This is both the
 * shape passed to `generateObject` (the model is forced into it) and the gate
 * validated again before saving. Percentages are constrained 0–100 but NOT
 * required to sum to 100 here — the model often returns 99/101, so the pipeline
 * normalizes to exactly 100 before persisting (§19 framing output rules).
 *
 * `bias_score` is intentionally absent: it is derived in code as
 * `(right − left) / 100`, never modeled (§19).
 */
export const analysisSchema = z.object({
  summary: z
    .string()
    .describe("Neutral, factual summary of the article. No opinion or spin."),
  sentimentScore: z
    .number()
    .min(-1)
    .max(1)
    .describe("Overall sentiment of the article tone, from -1 to 1."),
  sentimentLabel: z
    .enum(["positive", "neutral", "negative"])
    .describe("Sentiment label matching the score."),
  politicalFramingLabel: z
    .enum(["left", "center", "right", "mixed", "unclear"])
    .describe(
      "AI-estimated political framing. Match the strongest percentage unless " +
        "confidence is low or percentages are close; use 'unclear' when evidence is weak.",
    ),
  leftPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated share of left-leaning framing (0–100)."),
  centerPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated share of center/neutral framing (0–100)."),
  rightPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe("Estimated share of right-leaning framing (0–100)."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in the framing estimate, 0–1. Keep low when evidence is weak."),
  framingNotes: z
    .string()
    .describe("Short notes on how the article frames its subject."),
  loadedTerms: z
    .array(z.string())
    .describe("Emotionally loaded or slanted terms found in the article text."),
  disclaimer: z
    .string()
    .describe("Reminder that the framing is AI-estimated, not objective truth."),
});

/** Validated AI analysis output (pre-normalization). */
export type AnalysisOutput = z.infer<typeof analysisSchema>;
