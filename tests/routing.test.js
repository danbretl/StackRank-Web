import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vercelConfig = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);
const vercelIgnore = fs
  .readFileSync(new URL("../.vercelignore", import.meta.url), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

test("Vercel routes the temporary root entry point to the canonical movies app", () => {
  assert.deepEqual(vercelConfig.redirects, [
    {
      source: "/",
      destination: "/movies",
      permanent: false,
    },
  ]);
});

test("Vercel serves the static SPA at /movies without changing the visible URL", () => {
  assert.equal(vercelConfig.trailingSlash, false);
  assert.deepEqual(vercelConfig.rewrites, [
    {
      source: "/movies",
      destination: "/index.html",
    },
    {
      source: "/books",
      destination: "/books.html",
    },
    {
      source: "/dogs",
      destination: "/dogs.html",
    },
    {
      source: "/privacy",
      destination: "/privacy.html",
    },
    {
      source: "/s/dogs/:slug",
      destination: "/dogs-shared.html",
    },
    {
      source: "/s/:slug",
      destination: "/shared.html",
    },
  ]);
});

test("Vercel applies the production browser security policy to every route", () => {
  const securityRule = vercelConfig.headers.find(({ source }) => source === "/(.*)");
  assert.ok(securityRule);

  const headers = Object.fromEntries(
    securityRule.headers.map(({ key, value }) => [key, value]),
  );
  assert.match(headers["Content-Security-Policy"], /default-src 'self'/);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(headers["Content-Security-Policy"], /script-src 'self'/);
  assert.match(headers["Content-Security-Policy"], /https:\/\/hrfhakrxsllrqmscxxpb\.supabase\.co/);
  assert.match(headers["Content-Security-Policy"], /https:\/\/covers\.openlibrary\.org/);
  assert.equal(headers["Permissions-Policy"], "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("Vercel gives cache-busted static payloads immutable browser caching", () => {
  const cacheRules = new Map(
    vercelConfig.headers
      .filter(({ source }) => source !== "/(.*)")
      .map(({ source, headers }) => [
        source,
        Object.fromEntries(headers.map(({ key, value }) => [key, value])),
      ]),
  );
  for (const source of [
    "/app.js",
    "/styles.css",
    "/shared.js",
    "/books.js",
    "/books.css",
    "/dogs.js",
    "/dogs.css",
    "/dogs-shared.js",
    "/dogs-shared.css",
    "/home.js",
    "/home.css",
    "/data/dogs/(.*)",
    "/data/suggestion-packs.json",
    "/vendor/(.*)",
  ]) {
    assert.equal(
      cacheRules.get(source)?.["Cache-Control"],
      "public, max-age=31536000, immutable",
    );
  }
});

test("Books stays an explicitly noindex preview", () => {
  const booksRule = vercelConfig.headers.find(({ source }) => source === "/books");
  assert.equal(booksRule?.headers?.find(({ key }) => key === "X-Robots-Tag")?.value, "noindex, nofollow");
});

test("the family home artifact stays noindex until root cutover is authorized", () => {
  const homeRule = vercelConfig.headers.find(({ source }) => source === "/home.html");
  assert.equal(homeRule?.headers?.find(({ key }) => key === "X-Robots-Tag")?.value, "noindex, nofollow");
  assert.deepEqual(vercelConfig.redirects.find(({ source }) => source === "/"), {
    source: "/",
    destination: "/movies",
    permanent: false,
  });
});

test("Dogs is a public category route without weakening the Books noindex boundary", () => {
  const dogsRoute = vercelConfig.rewrites.find(({ source }) => source === "/dogs");
  assert.deepEqual(dogsRoute, { source: "/dogs", destination: "/dogs.html" });
  assert.equal(vercelConfig.headers.some(({ source }) => source === "/dogs"), false);
});

test("Dogs public snapshots use a category route without changing legacy Movies links", () => {
  assert.deepEqual(vercelConfig.rewrites.find(({ source }) => source === "/s/dogs/:slug"), {
    source: "/s/dogs/:slug",
    destination: "/dogs-shared.html",
  });
  assert.deepEqual(vercelConfig.rewrites.find(({ source }) => source === "/s/:slug"), {
    source: "/s/:slug",
    destination: "/shared.html",
  });
});

test("Vercel previews exclude versioned source and audit files that are not browser assets", () => {
  for (const path of [
    "logo-design-brief/",
    "notes/",
    "scripts/",
    "supabase/",
    "tests/",
    "data/dogs/sources/",
    "data/dogs/artwork-fixtures/",
    "data/dogs/classification.json",
    "data/dogs/classification-review.json",
    "data/dogs/catalog-overrides.json",
    "data/dogs/coverage-report.json",
    "data/dogs/artwork-coverage-report.json",
    "data/dogs/artwork-crop-recipes.json",
  ]) {
    assert.ok(vercelIgnore.includes(path), `${path} must stay out of Vercel uploads`);
  }

  for (const runtimePath of [
    "dogs.html",
    "dogs.js",
    "dogs.css",
    "dogs-shared.html",
    "dogs-shared.js",
    "dogs-shared.css",
    "data/dogs/dog-catalog.json",
    "data/dogs/packs.json",
    "data/dogs/image-rights.json",
    "data/dogs/artwork-license-policy.json",
  ]) {
    assert.equal(vercelIgnore.includes(runtimePath), false);
  }
});
