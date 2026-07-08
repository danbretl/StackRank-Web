import {
  jsonResponse,
  rejectDisallowedBrowserOrigin,
  stackRankCorsHeaders,
  stackRankPreflightResponse,
} from "../_shared/http.ts";
import { hasValidPublishableKey } from "../_shared/publishable-key.ts";

const genreNames: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Science Fiction",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10770: "TV Movie",
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

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "popular";
  const seed = url.searchParams.get("seed");
  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) {
    return jsonResponse({ error: "TMDB_API_KEY missing" }, 500, corsHeaders);
  }

  let tmdbUrl = "";
  if (type === "recommendations" && seed) {
    tmdbUrl =
      `https://api.themoviedb.org/3/movie/${seed}/recommendations?api_key=${tmdbKey}`;
  } else if (type === "trending") {
    tmdbUrl =
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`;
  } else if (type === "essentials") {
    const page = Math.floor(Math.random() * 8) + 1;
    const params = new URLSearchParams({
      api_key: tmdbKey,
      include_adult: "false",
      include_video: "false",
      language: "en-US",
      page: String(page),
      sort_by: "vote_average.desc",
      "vote_count.gte": "2500",
      "primary_release_date.lte": "2015-12-31",
      without_genres: "99,10755",
    });
    tmdbUrl =
      `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  } else {
    tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbKey}`;
  }

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
      genres: (movie.genre_ids || []).map((id: number) => genreNames[id])
        .filter(Boolean),
    }));
    return jsonResponse({ results }, 200, corsHeaders);
  } catch (_error) {
    return jsonResponse({ results: [] }, 200, corsHeaders);
  }
});
