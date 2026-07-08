import {
  jsonResponse,
  preflightResponse,
  PUBLIC_CORS_HEADERS,
} from "../_shared/http.ts";
import {
  clientRateLimitKey,
  takeRateLimitToken,
} from "../_shared/rate-limit.ts";

const allowedSizes = new Set(["w92", "w154", "w185", "w342", "w500"]);
const POSTER_CACHE_CONTROL =
  "public, max-age=604800, s-maxage=2592000, immutable";
const POSTER_RATE_LIMIT = 300;
const POSTER_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const posterRateLimitBuckets = new Map();

const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, status, PUBLIC_CORS_HEADERS);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(PUBLIC_CORS_HEADERS);
  }

  const rateLimit = takeRateLimitToken(
    posterRateLimitBuckets,
    clientRateLimitKey(req),
    {
      limit: POSTER_RATE_LIMIT,
      windowMs: POSTER_RATE_LIMIT_WINDOW_MS,
    },
  );
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many poster requests" },
      429,
      {
        ...PUBLIC_CORS_HEADERS,
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    );
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";
  const size = url.searchParams.get("size") || "w342";

  if (!allowedSizes.has(size)) {
    return errorResponse("Unsupported poster size");
  }

  if (!/^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(path)) {
    return errorResponse("Valid poster path required");
  }

  try {
    const response = await fetch(`https://image.tmdb.org/t/p/${size}${path}`);
    if (!response.ok || !response.body) {
      return errorResponse(
        "Poster not found",
        response.status === 404 ? 404 : 502,
      );
    }

    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    return new Response(response.body, {
      headers: {
        ...PUBLIC_CORS_HEADERS,
        "Cache-Control": POSTER_CACHE_CONTROL,
        "Content-Type": contentType,
      },
      status: 200,
    });
  } catch (_error) {
    return errorResponse("Could not load poster", 502);
  }
});
