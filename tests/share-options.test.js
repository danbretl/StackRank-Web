import test from "node:test";
import assert from "node:assert/strict";

import {
  SHARE_OPTIONS_VERSION,
  createDefaultShareOptions,
  normalizeShareOptions,
  parseShareOptions,
} from "../lib/share-options.js";

test("default Share Studio options enable every content section", () => {
  assert.deepEqual(createDefaultShareOptions(), {
    version: SHARE_OPTIONS_VERSION,
    displayName: "",
    top: true,
    bottom: true,
    eras: true,
    genres: true,
    people: true,
    queues: true,
    packs: true,
    fullList: true,
    fullListStyle: "mixed",
    theme: "classic",
    tone: "neutral",
    format: "single",
    shape: "skinny",
  });
  assert.notEqual(
    createDefaultShareOptions(),
    createDefaultShareOptions(),
    "callers receive independent mutable option objects",
  );
});

test("current Share Studio preferences survive normalization", () => {
  const options = {
    version: SHARE_OPTIONS_VERSION,
    displayName: "A".repeat(50),
    top: false,
    bottom: false,
    eras: false,
    genres: false,
    people: false,
    queues: false,
    packs: false,
    fullList: false,
    fullListStyle: "text",
    theme: "marquee",
    tone: "funny",
    format: "set",
    shape: "wide",
  };
  const normalized = normalizeShareOptions(options);
  assert.equal(normalized.displayName, "A".repeat(36));
  assert.deepEqual(normalized, {
    ...options,
    displayName: "A".repeat(36),
  });
});

test("legacy Share Studio preferences migrate renamed and newly added options", () => {
  assert.deepEqual(
    normalizeShareOptions({
      version: 1,
      top: false,
      decades: false,
      range: false,
      tone: "savage",
      shape: "landscape",
    }),
    {
      ...createDefaultShareOptions(),
      top: false,
      eras: false,
      tone: "extreme",
      shape: "wide",
    },
  );

  const v6 = normalizeShareOptions({
    version: 6,
    packs: undefined,
    format: "set",
    fullListStyle: "posters",
  });
  assert.equal(v6.packs, true, "the v7 packs section defaults on");
  assert.equal(v6.format, "set");
  assert.equal(v6.fullListStyle, "posters");
});

test("invalid Share Studio enum values fall back to supported defaults", () => {
  const normalized = normalizeShareOptions({
    version: SHARE_OPTIONS_VERSION,
    fullListStyle: "tiles",
    theme: "neon",
    tone: "mean",
    format: "pages",
    shape: "square",
  });
  assert.equal(normalized.fullListStyle, "mixed");
  assert.equal(normalized.theme, "classic");
  assert.equal(normalized.tone, "neutral");
  assert.equal(normalized.format, "single");
  assert.equal(normalized.shape, "skinny");
});

test("serialized Share Studio options parse through the same migration path", () => {
  assert.deepEqual(
    parseShareOptions(JSON.stringify({ version: 3, bottom: false, theme: "warm" })),
    {
      ...createDefaultShareOptions(),
      bottom: false,
      theme: "warm",
    },
  );
  assert.throws(() => parseShareOptions("{"));
  assert.throws(() => parseShareOptions("[]"));
  assert.throws(() => normalizeShareOptions(null));
});
