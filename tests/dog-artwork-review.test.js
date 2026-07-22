import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildArtworkReviewModel,
  renderArtworkReviewHtml,
} from "../scripts/build-dog-artwork-review.mjs";

const root = new URL("../", import.meta.url);
const fixture = async (name) =>
  JSON.parse(await readFile(new URL(`data/dogs/${name}`, root), "utf8"));

test("artwork review report models every exact ledger candidate with promoted items first", async () => {
  const model = buildArtworkReviewModel({
    ledger: await fixture("image-rights.json"),
    catalog: await fixture("dog-catalog.json"),
    packs: await fixture("packs.json"),
  });
  assert.equal(model.summary.candidates, 28);
  assert.equal(model.summary.promoted, 27);
  assert.equal(model.summary.pending, 0);
  assert.equal(model.assets.every((asset) => asset.ledgerReviewStatus === "approved"), true);
  assert.equal(model.assets[0].promoted, true);
  assert.equal(model.assets.at(-1).displayName, "Broholmer");
  assert.equal(model.assets.at(-1).promoted, false);
  assert.equal(model.assets.every((asset) =>
    asset.sourcePage.startsWith("https://commons.wikimedia.org/") &&
    asset.originalUrl.startsWith("https://upload.wikimedia.org/") &&
    asset.pinnedSourcePage.includes("oldid=") &&
    asset.sourceSha256.length === 64), true);
});

test("artwork review HTML is local-only, export-only, and embeds the complete evidence model", async () => {
  const model = buildArtworkReviewModel({
    ledger: await fixture("image-rights.json"),
    catalog: await fixture("dog-catalog.json"),
    packs: await fixture("packs.json"),
  });
  const html = renderArtworkReviewHtml(model);
  assert.match(html, /Review notes do not alter the rights ledger/);
  assert.match(html, /Export review notes/);
  assert.match(html, /stackrank:dogs-artwork-review:v1/);
  assert.match(html, /Pinned file revision/);
  assert.match(html, /Non-copyright restrictions reviewed/);
  assert.equal((html.match(/data-candidate(?:\s|>)/g) || []).length, 28);
  assert.doesNotMatch(html, />\s*Approve\s*</i);
  assert.doesNotMatch(html, />\s*Upload\s*</i);
  assert.doesNotMatch(html, /image-rights\.json['"]?\s*[,)]/);
});
