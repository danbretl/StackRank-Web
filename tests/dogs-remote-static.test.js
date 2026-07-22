import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dogsSource = fs.readFileSync(new URL("../dogs.js", import.meta.url), "utf8");
const sharedSource = fs.readFileSync(new URL("../dogs-shared.js", import.meta.url), "utf8");
const dogsDescriptor = fs.readFileSync(
  new URL("../lib/categories/dogs.js", import.meta.url),
  "utf8",
);

test("Dogs remote runtime support remains production fail-closed", () => {
  assert.match(dogsDescriptor, /accountSync:\s*false/);
  assert.match(dogsDescriptor, /publicSnapshots:\s*false/);
  assert.match(dogsSource, /__STACKRANK_DOGS_REMOTE_FIXTURE__\s*===\s*true/);
  assert.match(dogsSource, /\["localhost",\s*"127\.0\.0\.1",\s*"\[::1\]"\]/);
  assert.match(dogsSource, /get\("e2e"\)\s*===\s*"dogs-remote-sync"/);
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
  assert.match(dogsSource, /saveAll\(\{ syncRemote: false \}\)/);
  assert.match(dogsSource, /syncRemoteSnapshot\(snapshot, expectedListId, options\)/);
  assert.match(dogsSource, /categoryUserListId\(currentUser\?\.id\) !== expectedListId/);
  assert.match(dogsSource, /categoryUserListId\(currentUser\?\.id\) !== listId/);
  assert.match(
    dogsSource,
    /previousListId\s*&&\s*nextListId\s*&&\s*previousListId\s*!==\s*nextListId/,
  );
  assert.match(dogsSource, /if \(switchedAccounts\) clearDeviceStateAfterSignOut\(\)/);
  assert.match(dogsSource, /changedPersistedSurfaces\(beforeUndo, undoSnapshot\)/);
  assert.match(dogsSource, /list_updated_at:\s*stateUpdatedAt\.lists/);
  assert.match(dogsSource, /initialReconciliation:\s*true/);
});

test("Dogs public snapshots deliberately use a non-persistent anonymous client", () => {
  assert.match(sharedSource, /persistSession:\s*false/);
  assert.match(sharedSource, /autoRefreshToken:\s*false/);
  assert.match(sharedSource, /detectSessionInUrl:\s*false/);
  assert.match(sharedSource, /select\("slug,category,payload,created_at,updated_at"\)/);
  assert.doesNotMatch(sharedSource, /list_id|revoked_at|auth\./);
});
