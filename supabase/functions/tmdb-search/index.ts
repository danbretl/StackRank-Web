import {
  jsonResponse,
  rejectDisallowedBrowserOrigin,
  stackRankCorsHeaders,
  stackRankPreflightResponse,
} from "../_shared/http.ts";
import { hasValidPublishableKey } from "../_shared/publishable-key.ts";

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

  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  if (!query) {
    return jsonResponse({ results: [] }, 200, corsHeaders);
  }

  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) {
    return jsonResponse({ error: "TMDB_API_KEY missing" }, 500, corsHeaders);
  }

  const tmdbUrl =
    `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${
      encodeURIComponent(
        query,
      )
    }&include_adult=false`;

  try {
    const response = await fetch(tmdbUrl);
    if (!response.ok) {
      return jsonResponse({ results: [] }, 200, corsHeaders);
    }
    const data = await response.json();
    const results = (data.results || []).map((movie: any) => ({
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      posterPath: movie.poster_path,
    }));

    return jsonResponse({ results }, 200, corsHeaders);
  } catch (_error) {
    return jsonResponse({ results: [] }, 200, corsHeaders);
  }
});
