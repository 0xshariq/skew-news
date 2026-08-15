import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/api/admin-auth";
import { processScheduledResults } from "@/lib/pipeline/process-results";

/**
 * POST /api/oxylabs/scheduled-results/process (AGENTS.md §14/§15/§18).
 * Admin-secret protected. On-demand processing of completed Oxylabs job
 * results into articles via the shared scrape-to-insert pipeline. Thin handler —
 * logic lives in lib/pipeline/process-results.ts.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processScheduledResults();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[schedule] process failed:", err);
    return NextResponse.json(
      { error: "Scheduled processing failed", status: "failed" },
      { status: 500 },
    );
  }
}
