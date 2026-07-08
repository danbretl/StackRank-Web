import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vercelConfig = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

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
      source: "/privacy",
      destination: "/privacy.html",
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
  for (const source of ["/app.js", "/styles.css", "/data/suggestion-packs.json", "/vendor/(.*)"]) {
    assert.equal(
      cacheRules.get(source)?.["Cache-Control"],
      "public, max-age=31536000, immutable",
    );
  }
});
