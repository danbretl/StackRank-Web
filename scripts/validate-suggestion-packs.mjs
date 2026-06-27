#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCE_PATH = path.join(ROOT, "data", "suggestion-packs.source.json");
const OUTPUT_PATH = path.join(ROOT, "data", "suggestion-packs.json");
const MAX_PAIR_OVERLAP = 4;
const MAX_PAIR_SHARE = 0.35;
const MAX_MOVIE_REUSE = 6;
const EXPANSION_SORT_ORDER_START = 520;

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const output = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
const errors = [];

const duplicateValues = (items) =>
  [...new Map(items.map((value) => [value, 0])).keys()].filter(
    (value) => items.filter((candidate) => candidate === value).length > 1,
  );

const movieIdentity = (movie) =>
  movie.tmdbId != null
    ? `id:${movie.tmdbId}`
    : `title:${String(movie.title || "").trim().toLowerCase()}|${movie.year || ""}`;

const validatePackBasics = (packs, label) => {
  duplicateValues(packs.map((pack) => pack.slug)).forEach((slug) => {
    errors.push(`${label}: duplicate slug ${slug}`);
  });
  duplicateValues(packs.map((pack) => pack.title)).forEach((title) => {
    errors.push(`${label}: duplicate title ${title}`);
  });
  packs.forEach((pack) => {
    const ids = (pack.movies || []).map(movieIdentity);
    duplicateValues(ids).forEach((id) => {
      errors.push(`${label}: ${pack.slug} contains duplicate movie ${id}`);
    });
    if (!pack.category) errors.push(`${label}: ${pack.slug} has no category`);
    if (!pack.subtitle) errors.push(`${label}: ${pack.slug} has no subtitle`);
    if (!pack.movies?.length) errors.push(`${label}: ${pack.slug} has no movies`);
  });
};

validatePackBasics(source, "source");
validatePackBasics(output, "output");

if (source.length !== output.length) {
  errors.push(`source/output pack count mismatch: ${source.length} vs ${output.length}`);
}

const outputBySlug = new Map(output.map((pack) => [pack.slug, pack]));
source.forEach((pack) => {
  const generated = outputBySlug.get(pack.slug);
  if (!generated) {
    errors.push(`output missing ${pack.slug}`);
    return;
  }
  if (pack.movies.length !== generated.movies.length) {
    errors.push(`${pack.slug}: source/output movie count mismatch`);
  }
  pack.movies.forEach((movie, index) => {
    const generatedMovie = generated.movies[index];
    if (!generatedMovie) return;
    if (movie.year && Number(movie.year) !== Number(generatedMovie.year)) {
      errors.push(
        `${pack.slug}: ${movie.title} year changed from ${movie.year} to ${generatedMovie.year}`,
      );
    }
  });
});

const movieUsage = new Map();
output.forEach((pack) => {
  pack.movies.forEach((movie) => {
    const id = movieIdentity(movie);
    const uses = movieUsage.get(id) || { movie, packs: [] };
    uses.packs.push(pack.slug);
    movieUsage.set(id, uses);
    if (movie.tmdbId == null) errors.push(`${pack.slug}: ${movie.title} missing tmdbId`);
    if (!movie.posterPath) errors.push(`${pack.slug}: ${movie.title} missing posterPath`);
  });
});

let highestReuse = { count: 0, movie: null, packs: [] };
movieUsage.forEach(({ movie, packs }) => {
  if (packs.length > highestReuse.count) {
    highestReuse = { count: packs.length, movie, packs };
  }
  if (packs.length > MAX_MOVIE_REUSE) {
    errors.push(`${movie.title} appears in ${packs.length} packs: ${packs.join(", ")}`);
  }
});

let highestPair = { count: 0, share: 0, a: "", b: "", movies: [] };
let highestExpansionPair = { count: 0, share: 0, a: "", b: "", movies: [] };
for (let i = 0; i < output.length; i += 1) {
  const a = output[i];
  const aIds = new Set(a.movies.map(movieIdentity));
  for (let j = i + 1; j < output.length; j += 1) {
    const b = output[j];
    const overlap = b.movies.filter((movie) => aIds.has(movieIdentity(movie)));
    const share = overlap.length / Math.min(a.movies.length, b.movies.length);
    const involvesExpansion =
      Number(a.sort_order || 0) >= EXPANSION_SORT_ORDER_START ||
      Number(b.sort_order || 0) >= EXPANSION_SORT_ORDER_START;
    if (overlap.length > highestPair.count || (overlap.length === highestPair.count && share > highestPair.share)) {
      highestPair = {
        count: overlap.length,
        share,
        a: a.slug,
        b: b.slug,
        movies: overlap.map((movie) => movie.title),
      };
    }
    if (
      involvesExpansion &&
      (overlap.length > highestExpansionPair.count ||
        (overlap.length === highestExpansionPair.count && share > highestExpansionPair.share))
    ) {
      highestExpansionPair = {
        count: overlap.length,
        share,
        a: a.slug,
        b: b.slug,
        movies: overlap.map((movie) => movie.title),
      };
    }
    if (involvesExpansion && (overlap.length > MAX_PAIR_OVERLAP || share > MAX_PAIR_SHARE)) {
      errors.push(
        `${a.slug} / ${b.slug} overlap by ${overlap.length} movies (${Math.round(share * 100)}%): ${overlap
          .map((movie) => movie.title)
          .join(", ")}`,
      );
    }
  }
}

const categories = new Set(output.map((pack) => pack.category));
const summary = {
  packs: output.length,
  movies: output.reduce((sum, pack) => sum + pack.movies.length, 0),
  uniqueMovies: movieUsage.size,
  categories: categories.size,
  highestPairOverlap: {
    packs: [highestPair.a, highestPair.b],
    movies: highestPair.count,
    share: `${Math.round(highestPair.share * 100)}%`,
    titles: highestPair.movies,
  },
  highestExpansionPairOverlap: {
    packs: [highestExpansionPair.a, highestExpansionPair.b].filter(Boolean),
    movies: highestExpansionPair.count,
    share: `${Math.round(highestExpansionPair.share * 100)}%`,
    titles: highestExpansionPair.movies,
  },
  highestMovieReuse: {
    title: highestReuse.movie?.title || "",
    packs: highestReuse.count,
  },
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) {
  console.error(`\n${errors.length} validation error${errors.length === 1 ? "" : "s"}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("\nSuggestion pack validation passed.");
}
