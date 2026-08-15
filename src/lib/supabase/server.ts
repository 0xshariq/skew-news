import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role Supabase client for server-side reads and pipeline writes.
 * Bypasses RLS, so it must never be imported by client code (AGENTS.md §21).
 * `import "server-only"` fails the build if this module reaches the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
