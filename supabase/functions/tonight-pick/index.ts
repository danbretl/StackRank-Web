// "Pick something for tonight" enrichment + mood scoring endpoint.
//
// The client sends the Watch next queue's TMDB ids plus an optional free-text
// mood/vibe. For each candidate this function fetches runtime, genres, and
// keywords from TMDB (key stays server-side), interprets the mood through the
// shared lexicon, and returns per-candidate facts plus a mood-fit score with
// the matched signals. The client blends mood fit with its rank-weighted
// taste signals and the chosen time window. No TMDB ratings are returned.

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
import { interpretMood, scoreMoodMatch } from "../_shared/mood.ts";

const MAX_CANDIDATES = 80;
const MAX_MOOD_LENGTH = 160;
const MAX_KEYWORDS = 14;
const FETCH_BATCH_SIZE = 6;

// Per-instance enrichment cache. Edge instances are ephemeral, so this is a
// best-effort warm cache for repeat picks within one instance's lifetime.
const FACT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FACT_CACHE_MAX = 600;
type CandidateFacts = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  runtime: number | null;
  genres: string[];
  keywords: string[];
  director: string;
  cast: string[];
};
const factCache = new Map<number, { facts: CandidateFacts | null; expiresAt: number }>();

// Coarse per-IP brake: each request fans out to up to MAX_CANDIDATES TMDB
// calls, so keep the request budget tighter than the JSON proxies.
const rateLimitStore: RateLimitStore = new Map();
const RATE_LIMIT = { limit: 60, windowMs: 5 * 60 * 1000 };

const pruneFactCache = () => {
  if (factCache.size <= FACT_CACHE_MAX) return;
  const now = Date.now();
  for (const [key, entry] of factCache) {
    if (entry.expiresAt <= now) factCache.delete(key);
  }
  while (factCache.size > FACT_CACHE_MAX) {
    const oldest = factCache.keys().next().value;
    if (oldest === undefined) break;
    factCache.delete(oldest);
  }
};

const fetchCandidateFacts = async (
  tmdbId: number,
  tmdbKey: string,
): Promise<CandidateFacts | null> => {
  const cached = factCache.get(tmdbId);
  if (cached && cached.expiresAt > Date.now()) return cached.facts;

  const params = new URLSearchParams({
    api_key: tmdbKey,
    append_to_response: "keywords,credits",
    language: "en-US",
  });
  let facts: CandidateFacts | null = null;
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?${params.toString()}`,
    );
    if (response.ok) {
      const movie = await response.json();
      facts = {
        tmdbId: movie.id,
        title: movie.title || "",
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
        posterPath: movie.poster_path || null,
        runtime: Number.isFinite(movie.runtime) && movie.runtime > 0 ? movie.runtime : null,
        genres: (movie.genres || [])
          .map((genre: { name?: string }) => genre?.name)
          .filter((name: unknown): name is string => typeof name === "string" && name.length > 0),
        keywords: (movie.keywords?.keywords || [])
          .map((keyword: { name?: string }) => keyword?.name)
          .filter((name: unknown): name is string => typeof name === "string" && name.length > 0)
          .slice(0, MAX_KEYWORDS),
        director: (movie.credits?.crew || []).find(
          (person: { job?: string }) => person?.job === "Director",
        )?.name || "",
        cast: (movie.credits?.cast || [])
          .slice(0, 3)
          .map((person: { name?: string }) => person?.name)
          .filter((name: unknown): name is string => typeof name === "string" && name.length > 0),
      };
    }
  } catch (_error) {
    facts = null;
  }

  pruneFactCache();
  factCache.set(tmdbId, { facts, expiresAt: Date.now() + FACT_CACHE_TTL_MS });
  return facts;
};

const parseCandidateIds = (raw: string | null): number[] | null => {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length || parts.length > MAX_CANDIDATES) return null;
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    if (!/^\d{1,10}$/.test(part)) return null;
    const id = Number(part);
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return stackRankPreflightResponse(req);
  }

  const originRejection = rejectDisallowedBrowserOrigin(req);
  if (originRejection) {
    return originRejection;
  }

  const corsHeaders = stackRankCorsHeaders(req);

  if (!hasValidPublishableKey(req)) {
    return jsonResponse(
      { error: "Valid publishable API key required" },
      401,
      corsHeaders,
    );
  }

  const rateToken = takeRateLimitToken(
    rateLimitStore,
    clientRateLimitKey(req),
    RATE_LIMIT,
  );
  if (!rateToken.allowed) {
    corsHeaders.set("Retry-After", String(rateToken.retryAfterSeconds));
    return jsonResponse({ error: "Too many requests" }, 429, corsHeaders);
  }

  const url = new URL(req.url);
  const ids = parseCandidateIds(url.searchParams.get("ids"));
  if (!ids) {
    return jsonResponse(
      { error: `ids must be 1-${MAX_CANDIDATES} comma-separated TMDB ids` },
      400,
      corsHeaders,
    );
  }

  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) {
    return jsonResponse({ error: "TMDB_API_KEY missing" }, 500, corsHeaders);
  }

  const moodInput = (url.searchParams.get("mood") || "").slice(0, MAX_MOOD_LENGTH);
  const profile = interpretMood(moodInput);

  const factsById = new Map<number, CandidateFacts | null>();
  for (let index = 0; index < ids.length; index += FETCH_BATCH_SIZE) {
    const batch = ids.slice(index, index + FETCH_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map((id) => fetchCandidateFacts(id, tmdbKey)),
    );
    batch.forEach((id, offset) => factsById.set(id, settled[offset]));
  }

  const results = ids
    .map((id) => {
      const facts = factsById.get(id);
      if (!facts) return null;
      const moodMatch = profile.readable ? scoreMoodMatch(profile, facts) : null;
      return {
        ...facts,
        moodScore: moodMatch ? moodMatch.score : null,
        moodMatches: moodMatch
          ? { senses: moodMatch.senses, keywords: moodMatch.keywords, era: moodMatch.era }
          : null,
      };
    })
    .filter(Boolean);

  return jsonResponse(
    {
      mood: moodInput
        ? {
          readable: profile.readable,
          recognized: profile.recognized,
          era: profile.era ? profile.era.label : null,
          runtimeHint: profile.runtimeHint,
        }
        : null,
      results,
    },
    200,
    corsHeaders,
  );
});
