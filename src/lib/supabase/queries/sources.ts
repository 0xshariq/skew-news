import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/supabase/types";

/** All active sources (scraping/scheduling use these; §8). */
export async function getActiveSources(): Promise<Source[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load active sources: ${error.message}`);
  }

  return data ?? [];
}

/** Every source regardless of active state. */
export async function getAllSources(): Promise<Source[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sources")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load sources: ${error.message}`);
  }

  return data ?? [];
}
