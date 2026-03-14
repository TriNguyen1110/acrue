import { rateLimiter } from "@/lib/rateLimiter";

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY environment variable is not set");
  return key;
}

/**
 * Base Finnhub GET request routed through the rate limiter.
 * Every outbound API call must go through here — never fetch Finnhub directly.
 */
export function finnhubGet<T>(
  path: string,
  params: Record<string, string> = {},
  priority: "high" | "medium" | "low" = "medium"
): Promise<T> {
  return rateLimiter.enqueue(async () => {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("token", apiKey());
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Finnhub ${path} responded ${res.status}`);
    return res.json() as Promise<T>;
  }, priority);
}
