import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return jsonResponse({ error: "Valid movie id required" }, 400);
  }

  const tmdbKey = Deno.env.get("TMDB_API_KEY");
  if (!tmdbKey) {
    return jsonResponse({ error: "TMDB_API_KEY missing" }, 500);
  }

  const params = new URLSearchParams({
    api_key: tmdbKey,
    append_to_response: "credits",
    language: "en-US",
  });
  const tmdbUrl = `https://api.themoviedb.org/3/movie/${id}?${params.toString()}`;

  try {
    const response = await fetch(tmdbUrl);
    if (!response.ok) {
      return jsonResponse({ error: "Movie details not found" }, response.status === 404 ? 404 : 200);
    }

    const movie = await response.json();
    const director = (movie.credits?.crew || []).find((person: any) => person.job === "Director");
    const cast = (movie.credits?.cast || []).slice(0, 3).map((person: any) => person.name).filter(Boolean);
    const genres = (movie.genres || []).map((genre: any) => genre.name).filter(Boolean);

    return jsonResponse({
      result: {
        tmdbId: movie.id,
        title: movie.title,
        year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
        posterPath: movie.poster_path,
        overview: movie.overview || "",
        runtime: movie.runtime || null,
        genres,
        director: director?.name || "",
        cast,
      },
    });
  } catch (_error) {
    return jsonResponse({ error: "Could not load movie details" }, 200);
  }
});
