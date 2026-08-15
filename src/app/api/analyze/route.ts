import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/api/admin-auth";
import { runAnalysis } from "@/lib/pipeline/analyze";
import { getPostHogClient } from "@/lib/posthog-server";
import type { AnalyzeOptions } from "@/lib/pipeline/types";

/**
 * POST /api/analyze (AGENTS.md §14/§15/§19). Admin-secret protected. Runs the AI
 * analysis pipeline synchronously and returns the run summary. Thin handler —
 * all logic lives in `lib/pipeline/analyze.ts`. Defaults to all pending articles.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseOptions(body: unknown): AnalyzeOptions {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;

  const limit =
    typeof record.limit === "number" && Number.isFinite(record.limit)
      ? record.limit
      : undefined;

  const articleIds = Array.isArray(record.articleIds)
    ? record.articleIds.filter((id): id is string => typeof id === "string")
    : undefined;

  return { limit, articleIds };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const summary = await runAnalysis(parseOptions(body));

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: "skew_server",
      event: "analysis_completed",
      properties: {
        status: summary.status,
        pending: summary.pending,
        analyzed: summary.analyzed,
        failed: summary.failed,
        batches: summary.batches,
        duration_ms: summary.durationMs,
      },
    });
    await posthog.flush();

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[analyze] run failed:", err);
    return NextResponse.json(
      { error: "Analysis failed", status: "failed" },
      { status: 500 },
    );
  }
}
