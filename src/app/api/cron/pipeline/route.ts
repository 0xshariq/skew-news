import { NextResponse } from "next/server";

import { runCronPipeline } from "@/lib/pipeline/cron";

/**
 * GET /api/cron/pipeline (AGENTS.md §14/§18). Internal-only automatic pipeline:
 * process scheduled results, then run AI analysis. Vercel Cron always sends GET,
 * so this is the one GET action exception. Protected by `CRON_SECRET` (injected
 * by Vercel) — a missing/wrong secret returns 401 in production. In local dev the
 * check is skipped so the route can be curled. Never guarded by SKEW_ADMIN_SECRET.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Verify the request carries the Vercel-injected cron secret. Vercel sends it as
 * `Authorization: Bearer <CRON_SECRET>`. Skipped outside production for manual
 * local testing (§18).
 */
function isCronAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runCronPipeline();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[cron] pipeline failed:", err);
    return NextResponse.json(
      { error: "Cron pipeline failed", status: "failed" },
      { status: 500 },
    );
  }
}
