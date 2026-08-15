import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { Log, LogInsert } from "@/lib/supabase/types";

/** Append a pipeline log row (§7). Never throws — logging must not break a run. */
export async function createLog(entry: LogInsert): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("logs").insert(entry);

  if (error) {
    console.error(`Failed to write log (${entry.event}): ${error.message}`);
  }
}

/** Most recent log rows, newest first. */
export async function getRecentLogs(limit = 50): Promise<Log[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load logs: ${error.message}`);
  }

  return data ?? [];
}
