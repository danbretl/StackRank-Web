#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCE_PATH = path.join(ROOT, "data", "suggestion-packs.source.json");
const OUTPUT_PATH = path.join(ROOT, "data", "suggestion-packs.json");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hrfhakrxsllrqmscxxpb.supabase.co";
const TMDB_API_BASE = "https://api.themoviedb.org/3";

const args = new Set(process.argv.slice(2));
const shouldUpload = args.has("--upload");
const shouldWrite = !args.has("--dry-run");

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const readPublicAnonKey = async () => {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const appJs = await readFile(path.join(ROOT, "app.js"), "utf8");
  return appJs.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)?.[1] || "";
};

const tmdbFetch = async (pathName, params = {}) => {
  const key = requireEnv("TMDB_API_KEY");
  const url = new URL(`${TMDB_API_BASE}${pathName}`);
  const headers = { accept: "application/json" };
  if (key.includes(".")) {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key);
  }
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  });
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB ${response.status} for ${url.pathname}: ${body.slice(0, 180)}`);
  }
  return response.json();
};

const tmdbProxySearch = async (query) => {
  const anonKey = await readPublicAnonKey();
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY or TMDB_API_KEY is required");
  }
  const url = new URL(`${SUPABASE_URL}/functions/v1/tmdb-search`);
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB proxy ${response.status} for ${query}: ${body.slice(0, 180)}`);
  }
  const data = await response.json();
  return data.results || [];
};

const tmdbProxyDetail = async (tmdbId) => {
  const anonKey = await readPublicAnonKey();
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY or TMDB_API_KEY is required");
  }
  const url = new URL(`${SUPABASE_URL}/functions/v1/tmdb-detail`);
  url.searchParams.set("id", String(tmdbId));
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB detail proxy ${response.status} for ${tmdbId}: ${body.slice(0, 180)}`);
  }
  const data = await response.json();
  if (!data.result) {
    throw new Error(`TMDB detail proxy returned no result for ${tmdbId}`);
  }
  return data.result;
};

const releaseYear = (movie) => {
  const date = movie.release_date || movie.first_air_date || "";
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
};

const normalizeMovie = (movie) => ({
  tmdbId: movie.id,
  title: movie.title || movie.name,
  year: releaseYear(movie),
  posterPath: movie.poster_path || null,
});

const scoreSearchResult = (candidate, item) => {
  const candidateYear = candidate.year || releaseYear(candidate);
  const candidateTitle = candidate.title || "";
  let score = 0;
  if ((candidate.id || candidate.tmdbId) === item.tmdbId) score += 100;
  if (item.year && candidateYear === item.year) score += 20;
  if (candidateTitle.toLowerCase() === item.title.toLowerCase()) score += 10;
  return score + Number(candidate.popularity || 0) / 100;
};

const resolveMovie = async (item) => {
  if (!process.env.TMDB_API_KEY) {
    if (item.tmdbId) {
      try {
        const movie = await tmdbProxyDetail(item.tmdbId);
        return {
          tmdbId: movie.tmdbId,
          title: item.title || movie.title,
          year: item.year || movie.year || null,
          posterPath: movie.posterPath || null,
        };
      } catch (error) {
        console.warn(`Falling back to proxy search for ${item.title}: ${error.message}`);
      }
    }
    const results = await tmdbProxySearch(item.title);
    const [best] = [...results].sort((a, b) => scoreSearchResult(b, item) - scoreSearchResult(a, item));
    if (!best) {
      throw new Error(`Could not resolve ${item.title} (${item.year || "unknown year"})`);
    }
    return {
      tmdbId: best.tmdbId,
      title: item.title || best.title,
      year: item.year || best.year || null,
      posterPath: best.posterPath || null,
    };
  }

  if (item.tmdbId) {
    try {
      const movie = await tmdbFetch(`/movie/${item.tmdbId}`);
      return normalizeMovie(movie);
    } catch (error) {
      console.warn(`Falling back to search for ${item.title}: ${error.message}`);
    }
  }

  const search = await tmdbFetch("/search/movie", {
    query: item.title,
    year: item.year,
    include_adult: false,
  });
  const [best] = [...(search.results || [])].sort(
    (a, b) => scoreSearchResult(b, item) - scoreSearchResult(a, item),
  );
  if (!best) {
    throw new Error(`Could not resolve ${item.title} (${item.year || "unknown year"})`);
  }
  return normalizeMovie(best);
};

const toPackRow = async (pack) => {
  const movies = [];
  for (const item of pack.movies || []) {
    movies.push(await resolveMovie(item));
  }
  return {
    slug: pack.slug,
    title: pack.title,
    subtitle: pack.subtitle || "",
    category: pack.category,
    movies,
    version: pack.version || 1,
    provenance: pack.provenance || null,
    active: pack.active !== false,
    sort_order: pack.sortOrder ?? pack.sort_order ?? 0,
    cover_path: pack.coverPath || pack.cover_path || null,
  };
};

const upsertPackRows = async (rows) => {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/suggestion_packs?on_conflict=slug`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(
      rows.map((row) => ({
        ...row,
        updated_at: new Date().toISOString(),
      })),
    ),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase upsert failed: ${response.status} ${body}`);
  }
};

const main = async () => {
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
  const rows = [];
  for (const pack of source) {
    console.log(`Resolving ${pack.slug}`);
    rows.push(await toPackRow(pack));
  }

  if (shouldWrite) {
    await writeFile(OUTPUT_PATH, `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
  }

  if (shouldUpload) {
    await upsertPackRows(rows);
    console.log(`Uploaded ${rows.length} suggestion packs`);
  } else {
    console.log("Skipped upload. Pass --upload with SUPABASE_SERVICE_ROLE_KEY to upsert packs.");
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
