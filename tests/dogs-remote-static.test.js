import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dogsSource = fs.readFileSync(new URL("../dogs.js", import.meta.url), "utf8");
const sharedSource = fs.readFileSync(new URL("../dogs-shared.js", import.meta.url), "utf8");
const dogsDescriptor = fs.readFileSync(
  new URL("../lib/categories/dogs.js", import.meta.url),
  "utf8",
);
const dogsHtml = fs.readFileSync(new URL("../dogs.html", import.meta.url), "utf8");

test("Dogs production runtime enables additive sync and public snapshots", () => {
  assert.match(dogsDescriptor, /accountSync:\s*true/);
  assert.match(dogsDescriptor, /publicSnapshots:\s*true/);
  assert.match(dogsDescriptor, /rasterArtworkExport:\s*false/);
  assert.match(dogsSource, /__STACKRANK_DOGS_REMOTE_FIXTURE__\s*===\s*true/);
  assert.match(dogsSource, /\["localhost",\s*"127\.0\.0\.1",\s*"\[::1\]"\]/);
  assert.match(dogsSource, /get\("e2e"\)\s*===\s*"dogs-remote-sync"/);
  assert.doesNotMatch(dogsHtml, /stay off until the additive Dogs RLS contract is approved/);
});

test("Dogs sync uses only additive category tables and bounded row builders", () => {
  for (const table of [
    "category_rankings",
    "category_lists",
    "category_pack_progress",
    "category_shared_lists",
  ]) {
    assert.match(dogsSource, new RegExp(`from\\("${table}"\\)`));
  }
  for (const legacyTable of ["rankings", "movie_lists", "pack_progress", "shared_lists"]) {
    assert.doesNotMatch(dogsSource, new RegExp(`from\\("${legacyTable}"\\)`));
  }
  assert.match(dogsSource, /buildCategoryRankingRow/);
  assert.match(dogsSource, /buildCategoryListRow/);
  assert.match(dogsSource, /buildCategoryPackProgressRow/);
  // Runtime race coverage is in test-data-safety-browser.cjs; these checks enforce
  // the integration boundary rather than requiring the former unsafe merge flow.
  assert.match(dogsSource, /createDataSafetyStore/);
  assert.match(dogsSource, /compareAndSwapRow/);
  assert.doesNotMatch(dogsSource, /localStorage\.setItem\(STORAGE_KEYS/);
  assert.match(dogsSource, /safetyStore\.isCurrent/);
  assert.match(dogsSource, /changedPersistedSurfaces\(beforeUndo, undoSnapshot\)/);
  assert.match(dogsSource, /list_updated_at:\s*stateUpdatedAt\.lists/);

});

test("Dogs public snapshots deliberately use a non-persistent anonymous client", () => {
  // The shared helper's options/read behavior are exercised by its unit tests
  // and both actual-client security browser flows.
  assert.match(sharedSource, /auth:\s*PUBLIC_SHARE_AUTH_OPTIONS/);
  assert.match(sharedSource, /readPublicShare\(supabase, \{ category: CATEGORY, slug \}\)/);
  assert.doesNotMatch(sharedSource, /list_id|revoked_at|auth\./);
});

test("ordinary Dogs metadata surfaces do not render internal catalog codes", () => {
  for (const internalLabel of [
    "Catalog identity",
    "Catalog version",
    "Registry references",
    "Parent concept",
  ]) {
    assert.doesNotMatch(dogsSource, new RegExp(`addFact\\("${internalLabel}"`));
  }
  assert.doesNotMatch(dogsHtml, /pinned VBO release/);
  assert.match(dogsSource, /"Breed identity: Vertebrate Breed Ontology \(CC BY 4\.0\)\."/);
  assert.match(dogsSource, /addFact\(profile\?\.identityScope === "category" \? "Category" : profile\?\.typeBasis === "registry" \? "Registry group" : profile\?\.typeBasis === "catalog" \? "Type" : "Dog family", profile\?\.typeLabel\)/);
  assert.match(dogsSource, /dogDisplayAliases\(entity\)/);
  assert.match(dogsSource, /dogEditorialDisplayText\(pack\.title\)/);
});
