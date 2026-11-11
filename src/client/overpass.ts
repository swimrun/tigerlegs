/**
 * Client for the public Overpass API with the courtesy the service asks for: when a server is busy
 * it answers 429, 502, 503 or 504 and says "retry with exponential backoff", so we wait 1 s, then
 * 2 s, then 4 s (or the Retry-After it names, within a cap) before trying again, and only then fall
 * through to the next mirror. Anything else (a bad query, say) is not retried.
 */

// Public Overpass instances; the first is often overloaded, so fall through to the next.
export const OVERPASS_URLS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 20000;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export interface OverpassOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  /** Waits between attempts; replaced in tests so they do not sleep. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  urls?: readonly string[];
  /** Attempts per server before moving on to the next. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

/** Seconds from a Retry-After header, or null when it is absent or not a number of seconds. */
function retryAfterMs(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/** Runs an Overpass QL query and returns the parsed JSON, or throws the last error. */
export async function queryOverpass(query: string, options: OverpassOptions = {}): Promise<unknown> {
  const {
    signal,
    fetcher = fetch,
    sleep = defaultSleep,
    urls = OVERPASS_URLS,
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
  } = options;
  let lastError = "no Overpass server reachable";
  for (const url of urls) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      signal?.throwIfAborted();
      let wait: number | null = null;
      try {
        const response = await fetcher(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(query),
          headers: { "content-type": "application/x-www-form-urlencoded" },
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
            : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.ok) return await response.json();
        lastError = `Overpass returned status ${response.status}`;
        if (!RETRYABLE_STATUS.has(response.status)) break;
        wait = retryAfterMs(response);
      } catch (e) {
        if (signal?.aborted) throw e;
        // timeouts and network errors are retried like a busy server
        lastError = e instanceof Error ? e.message : String(e);
      }
      if (attempt < maxAttempts) await sleep(Math.min(wait ?? baseDelayMs * 2 ** (attempt - 1), maxDelayMs), signal);
    }
  }
  throw new Error(lastError);
}
