import { NextResponse } from "next/server";

import { isAuthorized } from "@/lib/api/admin-auth";
import { syncSchedules } from "@/lib/pipeline/schedule-sync";
import { getStoredSchedules } from "@/lib/supabase/queries/schedules";

/**
 * /api/oxylabs/schedules (AGENTS.md §14/§15/§18).
 * POST — sync: create one Oxylabs schedule per active source + deactivate
 *   orphans. Admin-secret protected.
 * GET  — list stored schedule rows.
 * Thin handlers — orchestration lives in lib/pipeline/schedule-sync.ts.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncSchedules();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[schedule] sync failed:", err);
    return NextResponse.json(
      { error: "Schedule sync failed", status: "failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const schedules = await getStoredSchedules();
    return NextResponse.json({ schedules }, { status: 200 });
  } catch (err) {
    console.error("[schedule] list failed:", err);
    return NextResponse.json(
      { error: "Failed to load schedules" },
      { status: 500 },
    );
  }
}
