import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const allowedSizes = new Set(["w92", "w154", "w185", "w342", "w500"]);

const errorResponse = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
      return errorResponse("Poster not found", response.status === 404 ? 404 : 502);
    }

    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, max-age=86400",
        "Content-Type": contentType,
      },
      status: 200,
    });
  } catch (_error) {
    return errorResponse("Could not load poster", 502);
  }
});
