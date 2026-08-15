import { NextResponse } from "next/server";

import { getStoredRuns } from "@/lib/supabase/queries/schedules";

/**
 * GET /api/oxylabs/runs (AGENTS.md §14). Read-only list of stored schedule run
 * rows with their per-job `result_status`. Thin handler.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await getStoredRuns();
    return NextResponse.json({ runs }, { status: 200 });
  } catch (err) {
    console.error("[schedule] runs list failed:", err);
    return NextResponse.json(
      { error: "Failed to load runs" },
      { status: 500 },
    );
  }
}
