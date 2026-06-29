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
  ]);
});
