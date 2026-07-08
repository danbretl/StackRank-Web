import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSharedListPayload,
  generateShareSlug,
  isValidShareSlug,
  normalizeSharedListPayload,
  shareSlugFromBytes,
  sharedListSlugFromPath,
  sharedListUrl,
} from "../lib/share-link.js";

test("share slugs are short URL-safe tokens from secure random bytes", () => {
  assert.equal(shareSlugFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])), "abcdefghjk");
  assert.equal(
    generateShareSlug({
      getRandomValues(bytes) {
        bytes.set(new Uint8Array([25, 26, 27, 28, 29, 30, 31, 0, 1, 2]));
        return bytes;
      },
    }),
    "456789aabc",
  );
  assert.equal(isValidShareSlug("23456789ab"), true);
  assert.equal(isValidShareSlug("short"), false);
  assert.equal(isValidShareSlug("ABCDEFGHIJ"), false);
});

test("shared list URLs and path slugs are deterministic", () => {
  assert.equal(sharedListUrl("https://www.stackrankapp.com", "23456789ab"), "https://www.stackrankapp.com/s/23456789ab");
  assert.equal(sharedListUrl("http://localhost:8000", "23456789ab"), "http://localhost:8000/s/23456789ab");
  assert.equal(sharedListSlugFromPath("/s/23456789ab"), "23456789ab");
  assert.equal(sharedListSlugFromPath("/s/23456789ab/"), "23456789ab");
  assert.equal(sharedListSlugFromPath("/movies"), "");
  assert.throws(() => sharedListUrl("https://www.stackrankapp.com", "../bad"));
});

test("shared list payloads keep only public snapshot movie fields", () => {
  const payload = buildSharedListPayload({
    displayName: "  Dan   Bretl  ",
    movies: [
      {
        title: "  The Matrix  ",
        year: "1999",
        posterPath: "/matrix.jpg",
        tmdbId: "603",
        rankedAt: "private",
        overview: "private",
      },
      {
        title: "",
        year: 2000,
        posterPath: "/ignored.jpg",
        tmdbId: 1,
      },
      {
        title: "Bad Poster",
        year: 2200,
        posterPath: "https://example.com/poster.jpg",
        tmdbId: -2,
      },
    ],
  });

  assert.deepEqual(payload, {
    displayName: "Dan Bretl",
    movies: [
      { title: "The Matrix", year: 1999, posterPath: "/matrix.jpg", tmdbId: 603 },
      { title: "Bad Poster", year: null, posterPath: null, tmdbId: null },
    ],
  });
});

test("shared list payload normalization tolerates malformed remote rows", () => {
  assert.deepEqual(normalizeSharedListPayload(null), { displayName: "", movies: [] });
  assert.deepEqual(
    normalizeSharedListPayload({
      displayName: "Viewer",
      movies: [{ title: "Heat", year: 1995, poster_path: "/heat.jpg", id: 949 }],
    }),
    {
      displayName: "Viewer",
      movies: [{ title: "Heat", year: 1995, posterPath: "/heat.jpg", tmdbId: 949 }],
    },
  );
});
