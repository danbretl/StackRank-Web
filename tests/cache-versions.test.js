import { test } from "node:test";
import assert from "node:assert/strict";

import {
  collectVersionedReferencesFromText,
  evaluateCacheManifest,
  findUnversionedAppLibImports,
  findUnversionedRuntimeJsImports,
  normalizeVersionedAssetPath,
} from "../scripts/check-cache-versions.mjs";

test("normalizes local and same-origin versioned asset paths", () => {
  assert.equal(
    normalizeVersionedAssetPath("styles.css", "index.html", "/repo"),
    "styles.css",
  );
  assert.equal(
    normalizeVersionedAssetPath("./lib/movie.js", "app.js", "/repo"),
    "lib/movie.js",
  );
  assert.equal(
    normalizeVersionedAssetPath(
      "https://www.stackrankapp.com/assets/og-preview.png",
      "index.html",
      "/repo",
    ),
    "assets/og-preview.png",
  );
  assert.equal(
    normalizeVersionedAssetPath("https://cdn.example.com/app.js", "index.html", "/repo"),
    null,
  );
});

test("collects versioned asset references from runtime source text", () => {
  const refs = collectVersionedReferencesFromText(
    `
      <link rel="stylesheet" href="styles.css?v=130" />
      <meta content="https://www.stackrankapp.com/assets/og-preview.png?v=1" />
      import { x } from "./lib/movie.js?v=2";
      const packs = "data/suggestion-packs.json?v=5";
    `,
    "app.js",
    "/repo",
  );

  assert.deepEqual(
    refs.map((ref) => [ref.assetPath, ref.v]),
    [
      ["styles.css", 130],
      ["assets/og-preview.png", 1],
      ["lib/movie.js", 2],
      ["data/suggestion-packs.json", 5],
    ],
  );
});

test("finds unversioned direct app lib imports", () => {
  const imports = findUnversionedAppLibImports(
    `
      import { a } from "./lib/movie.js";
      import { b } from "./lib/text.js?v=1";
      const lazy = import("./lib/undo.js");
    `,
    "app.js",
  );

  assert.deepEqual(
    imports.map((entry) => entry.specifier),
    ["./lib/movie.js", "./lib/undo.js"],
  );
});

test("finds unversioned relative runtime imports outside app.js", () => {
  const imports = findUnversionedRuntimeJsImports(
    `
      import { movieKey } from "./movie.js";
      import { dayKey } from "./format.js?v=1";
    `,
    "lib/insights.js",
  );

  assert.deepEqual(
    imports.map((entry) => [entry.sourcePath, entry.specifier]),
    [["lib/insights.js", "./movie.js"]],
  );
});

test("cache manifest fails when content changes without a version bump", () => {
  const result = evaluateCacheManifest(
    {
      "app.js": { hash: "new", v: 160 },
    },
    {
      "app.js": { hash: "old", v: 160 },
    },
  );

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].type, "stale-version");
  assert.equal(result.errors[0].assetPath, "app.js");
});

test("cache manifest updates when content and version both change", () => {
  const result = evaluateCacheManifest(
    {
      "app.js": { hash: "new", v: 160 },
    },
    {
      "app.js": { hash: "old", v: 159 },
    },
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.nextManifest, {
    "app.js": { hash: "new", v: 160 },
  });
  assert.deepEqual(result.changes, [{ type: "updated", assetPath: "app.js" }]);
});
