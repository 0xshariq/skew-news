import "server-only";

/**
 * Oxylabs Web Scraper API client (AGENTS.md §16/§21).
 * Manual scraping uses the synchronous Realtime endpoint with the `universal`
 * source to fetch homepage and article HTML. Credentials are server-only and
 * must never reach browser code.
 */

const REALTIME_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

/** Rendered Realtime requests can take a while; keep the client near 180s (skill). */
export const OXYLABS_TIMEOUT_MS = 180_000;

/** Result of a successful HTML fetch through Oxylabs. */
export interface FetchHtmlResult {
  html: string;
  statusCode: number;
  /** The URL Oxylabs reported for the result (after any redirects). */
  finalUrl: string;
}

/** Typed error for any Oxylabs failure — never carries credentials. */
export class OxylabsError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "OxylabsError";
  }
}

interface OxylabsResponse {
  results?: Array<{
    content?: string;
    status_code?: number;
    url?: string;
  }>;
}

function credentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;
  if (!username || !password) {
    throw new OxylabsError(
      "Missing Oxylabs env vars (OXY_WSA_USERNAME / OXY_WSA_PASSWORD)",
    );
  }
  return { username, password };
}

/**
 * Fetch a page's rendered HTML through Oxylabs `universal`. Throws OxylabsError
 * on transport failure, a non-200 Oxylabs response, a target status >= 400, or
 * empty content. The caller decides whether a failure aborts the source or just
 * skips one article.
 */
export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  const { username, password } = credentials();
  const auth = Buffer.from(`${username}:${password}`).toString("base64");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OXYLABS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(REALTIME_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "universal", url, render: "html" }),
      signal: controller.signal,
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? `timed out after ${OXYLABS_TIMEOUT_MS}ms`
        : "network error";
    throw new OxylabsError(`Oxylabs request failed (${reason}) for ${url}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // 401/403/429 etc. — do not echo auth details.
    throw new OxylabsError(
      `Oxylabs returned ${response.status} for ${url}`,
      response.status,
    );
  }

  let payload: OxylabsResponse;
  try {
    payload = (await response.json()) as OxylabsResponse;
  } catch {
    throw new OxylabsError(`Oxylabs returned invalid JSON for ${url}`);
  }

  const result = payload.results?.[0];
  const statusCode = result?.status_code ?? 0;

  if (!result || typeof result.content !== "string" || result.content === "") {
    throw new OxylabsError(`Oxylabs returned empty content for ${url}`);
  }
  if (statusCode >= 400) {
    throw new OxylabsError(
      `Target responded ${statusCode} for ${url}`,
      statusCode,
    );
  }

  return {
    html: result.content,
    statusCode,
    finalUrl: result.url ?? url,
  };
}
