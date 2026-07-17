import {
  jsonResponse,
  rejectDisallowedBrowserOrigin,
  stackRankCorsHeaders,
  stackRankPreflightResponse,
} from "../_shared/http.ts";
import { hasValidPublishableKey } from "../_shared/publishable-key.ts";
import {
  clientRateLimitKey,
  type RateLimitStore,
  takeRateLimitToken,
} from "../_shared/rate-limit.ts";
import { normalizeOpenLibraryBooks } from "../_shared/books.ts";

const MAX_QUERY_LENGTH = 120;
const RESULT_LIMIT = 8;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;
const RATE_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 };
const OPEN_LIBRARY_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
].join(",");

type CachedSearch = { results: ReturnType<typeof normalizeOpenLibraryBooks>; expiresAt: number };
const searchCache = new Map<string, CachedSearch>();
const rateLimitStore: RateLimitStore = new Map();

const pruneCache = () => {
  if (searchCache.size <= CACHE_MAX) return;
  const now = Date.now();
  for (const [key, value] of searchCache) {
    if (value.expiresAt <= now) searchCache.delete(key);
  }
  while (searchCache.size > CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest === undefined) break;
    searchCache.delete(oldest);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return stackRankPreflightResponse(req);
  const originRejection = rejectDisallowedBrowserOrigin(req);
  if (originRejection) return originRejection;
  const corsHeaders = stackRankCorsHeaders(req);

  if (!hasValidPublishableKey(req)) {
    return jsonResponse({ error: "Valid publishable API key required" }, 401, corsHeaders);
  }

  const token = takeRateLimitToken(rateLimitStore, clientRateLimitKey(req), RATE_LIMIT);
  if (!token.allowed) {
    corsHeaders.set("Retry-After", String(token.retryAfterSeconds));
    return jsonResponse({ error: "Too many book searches" }, 429, corsHeaders);
  }

  const url = new URL(req.url);
  const query = String(url.searchParams.get("q") || "").trim().replace(/\s+/g, " ");
  if (query.length < 2) return jsonResponse({ results: [] }, 200, corsHeaders);
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ error: `q must be at most ${MAX_QUERY_LENGTH} characters` }, 400, corsHeaders);
  }

  const cacheKey = query.toLocaleLowerCase("en-US");
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse({ results: cached.results }, 200, {
      ...Object.fromEntries(corsHeaders.entries()),
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "X-StackRank-Cache": "hit",
    });
  }

  const params = new URLSearchParams({
    q: query,
    limit: String(RESULT_LIMIT + 4),
    fields: OPEN_LIBRARY_FIELDS,
  });
  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: {
        "User-Agent": "StackRank/1.0 (https://www.stackrankapp.com; stackrank@danbretl.com)",
        "email": "stackrank@danbretl.com",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return jsonResponse({ error: "Book search is temporarily unavailable" }, 502, corsHeaders);
    }
    const payload = await response.json();
    const results = normalizeOpenLibraryBooks(payload?.docs, RESULT_LIMIT);
    pruneCache();
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    return jsonResponse({ results }, 200, {
      ...Object.fromEntries(corsHeaders.entries()),
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "X-StackRank-Cache": "miss",
    });
  } catch (_error) {
    return jsonResponse({ error: "Book search is temporarily unavailable" }, 502, corsHeaders);
  }
});
