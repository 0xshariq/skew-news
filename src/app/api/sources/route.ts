import { NextResponse } from "next/server";

import { getActiveSources } from "@/lib/supabase/queries/sources";

/**
 * GET /api/sources (AGENTS.md §8/§14). Read-only list of active sources for
 * choosing what to scrape. No admin secret required — returns no secrets.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sources = await getActiveSources();
    return NextResponse.json({
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        listing_url: s.listing_url,
      })),
    });
  } catch (err) {
    console.error("[sources] load failed:", err);
    return NextResponse.json(
      { error: "Failed to load sources" },
      { status: 500 },
    );
  }
}
