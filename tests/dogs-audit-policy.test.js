import assert from "node:assert/strict";
import test from "node:test";
import { dogProfileOrigins, normalizeDogEditorialFamilies, dogTypeLabel } from "../scripts/dog-profiles-lib.mjs";
import { normalizeDogCatalogEntity, dogDisplayAliases, canonicalizeDogStoredState, dogEntityToCandidate } from "../lib/categories/dogs.js";
import { completedDogCatalogIds, projectPublicDogRanking, reorderPublicDogRanking } from "../lib/dogs-public-visibility.js";
import { buildDogsBackup, parseDogsBackup, dogsExportText, buildDogTasteSignals } from "../lib/dogs.js";
import { buildCategoryRankingRow, buildCategoryListRow, categoryItemPayloadFromRow, mergeCategoryItemPayloads } from "../lib/category-remote-persistence.js";

const entity = (id, extra = {}) => ({ id, displayName: id, status: "canonical", selectable: true, sourceIds: [id], ...extra });
const A = "VBO:0200001", B = "VBO:0200002", H = "VBO:0200003", Q = "VBO:0200004", X = "VBO:0200005";
const art = (catalogId) => ({ catalogId, sourceType: "ai-generated", review: { status: "approved" }, uiDisplayAllowed: true,
  publicSnapshotAllowed: false, rasterExportAllowed: false, variants: ["card", "detail"].map(role => ({ role, mime: "image/webp", width: 960, height: 640, url: `assets/dogs/generated/${catalogId.replace(":", "-")}.webp` })) });

test("editorial suppression changes discovery without changing completion evidence, identity, backup, queues or account payloads", () => {
  const entities = [entity(A), entity(H, { editorialVisibility: "suppressed" }), entity(B), entity(Q, { editorialVisibility: "suppressed" }), entity(X, { editorialVisibility: "suppressed" })].map(normalizeDogCatalogEntity);
  const profiles = { profiles: Object.fromEntries(entities.map(e => [e.id, { reviewStatus: "editor-reviewed", summary: "Previously reviewed and preserved field note." }])) };
  const artwork = { assets: entities.map(e => art(e.id)) };
  const visible = completedDogCatalogIds({ entities, profiles, artwork });
  assert.deepEqual([...visible], [A, B]);
  assert.equal(entities[1].selectable, true);
  assert.equal(profiles.profiles[H].reviewStatus, "editor-reviewed");
  assert.equal(artwork.assets[1].review.status, "approved");
  const items = entities.map(e => ({ ...dogEntityToCandidate(e), rankedAt: "2026-10-01T00:00:00.000Z", comparisons: 3 }));
  const state = canonicalizeDogStoredState({ ranking: items.slice(0, 3), lists: { curious: [items[3]], not_for_me: [items[4]] } }, entities);
  assert.equal(state.remapped, 0);
  assert.equal(state.deduplicated, 0);
  assert.deepEqual(state.ranking.map(i => i.entityRef.id), [A, H, B]);
  const reordered = reorderPublicDogRanking(state.ranking, visible, [state.ranking[2], state.ranking[0]]);
  assert.deepEqual(reordered.map(i => i.entityRef.id), [B, H, A]);
  assert.equal(reordered[1], state.ranking[1]);
  const backup = buildDogsBackup({ ranking: reordered, lists: state.lists });
  const restored = parseDogsBackup(JSON.stringify(backup));
  assert.ok(restored);
  assert.deepEqual(restored.ranking.map(i => i.entityRef.id), [B, H, A]);
  assert.deepEqual(restored.lists.curious.map(i => i.entityRef.id), [Q]);
  assert.deepEqual(restored.lists.not_for_me.map(i => i.entityRef.id), [X]);
  const publicItems = projectPublicDogRanking(reordered, visible).map(row => row.item);
  assert.doesNotMatch(dogsExportText(publicItems, "fixture", "json"), new RegExp(H));
  const args = { listId: "user:12345678-1234-1234-1234-123456789abc", category: "dogs", updatedAt: "2026-10-06T00:00:00.000Z" };
  const rankingRow = buildCategoryRankingRow({ ...args, items: reordered });
  const decoded = categoryItemPayloadFromRow(rankingRow, args);
  const merged = mergeCategoryItemPayloads([decoded], { category: "dogs" });
  assert.deepEqual(merged.items.map(i => i.entityRef.id), [B, H, A]);
  for (const [listType, items] of Object.entries(state.lists)) {
    const row = buildCategoryListRow({ ...args, listType, items });
    assert.deepEqual(categoryItemPayloadFromRow(row, { ...args, listType }).items.map(i => i.entityRef.id), items.map(i => i.entityRef.id));
  }
  const restoredVisibility = completedDogCatalogIds({ entities: entities.map(({ editorialVisibility, ...e }) => e), profiles, artwork });
  assert.deepEqual(projectPublicDogRanking(reordered, restoredVisibility).map(row => row.item.entityRef.id), [B, H, A]);
});

test("display aliases are an explicit presentation choice while original search synonyms survive", () => {
  const e = normalizeDogCatalogEntity(entity(A, { aliases: ["Nanny Dog", "Staffy"], displayAliases: ["Staffy"] }));
  assert.deepEqual(e.aliases, ["Nanny Dog", "Staffy"]);
  assert.deepEqual(dogDisplayAliases(e), ["Staffy"]);
  assert.deepEqual(dogDisplayAliases(normalizeDogCatalogEntity({ ...e, displayAliases: [] })), []);
});

test("origin precedence separates registry attribution from historical geography and respects deliberate absence", () => {
  const base = { entity: entity(A, { originRegions: ["Authored catalog region"] }), fciRecord: { country: "GREAT BRITAIN" }, matched: { countries: ["Canada", "England", "German Empire"] } };
  assert.deepEqual(dogProfileOrigins(base), { regions: ["United Kingdom"], basis: "registry" });
  assert.deepEqual(dogProfileOrigins({ ...base, override: { originRegions: ["Historical region"] } }), { regions: ["Historical region"], basis: "editorial" });
  assert.deepEqual(dogProfileOrigins({ ...base, override: { originRegions: [] } }), { regions: [], basis: "editorial" });
  assert.deepEqual(dogProfileOrigins({ ...base, fciRecord: null }), { regions: ["Authored catalog region"], basis: "editorial" });
  assert.deepEqual(dogProfileOrigins({ entity: entity(A), matched: { countries: ["China", "People's Republic of China", "Soviet Union"] } }), { regions: ["China"], basis: "structured" });
});

test("family semantics merge explicit synonyms and keep utility/heritage tags out of ranked taste evidence", () => {
  assert.deepEqual(normalizeDogEditorialFamilies(["scenthound", "scent hound", "regional history", "coat silhouette", "non sporting", "French heritage", "giant"]), ["scent hound"]);
  assert.deepEqual(dogTypeLabel({ entity: { status: "canonical" } }), { label: "Breed or regional type", basis: "catalog" });
  assert.match(dogTypeLabel({ fciRecord: { groupNumber: 2 } }).label, /molossoid/);
  const ranked = [A, B, H].map(id => dogEntityToCandidate(entity(id)));
  const catalog = new Map([[A, { tags: normalizeDogEditorialFamilies(["scenthound", "regional history"]) }], [B, { tags: normalizeDogEditorialFamilies(["scent hound", "coat silhouette"]) }], [H, { tags: normalizeDogEditorialFamilies(["regional history", "coat silhouette"]) }]]);
  const signals = buildDogTasteSignals(ranked, catalog);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].value, "scent hound");
  assert.deepEqual(signals[0].items.map(i => i.entityRef.id), [A, B]);
});
