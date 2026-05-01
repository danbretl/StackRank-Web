import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "popular";
  const seed = url.searchParams.get("seed");
  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) {
    return new Response(JSON.stringify({ error: "TMDB_API_KEY missing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  let tmdbUrl = "";
  if (type === "recommendations" && seed) {
    tmdbUrl = `https://api.themoviedb.org/3/movie/${seed}/recommendations?api_key=${tmdbKey}`;
  } else if (type === "trending") {
    tmdbUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbKey}`;
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
    tmdbUrl = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
  } else {
    tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${tmdbKey}`;
  }

  try {
    const response = await fetch(tmdbUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const data = await response.json();
    const results = (data.results || []).map((movie: any) => ({
      tmdbId: movie.id,
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      posterPath: movie.poster_path,
    }));
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (_error) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
