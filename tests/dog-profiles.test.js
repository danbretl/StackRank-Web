import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDogProfiles,
  buildWikidataMatchIndex,
  dogTypeLabel,
  generatedProfileCopy,
  normalizeProfileName,
  uniqueWikidataMatch,
} from "../scripts/dog-profiles-lib.mjs";

test("Dog type labels prefer registry groups, then editorial families, with an honest catalog fallback", () => {
  assert.deepEqual(dogTypeLabel({ entity: { status: "canonical" }, fciRecord: { groupNumber: 8 } }), {
    label: "Retrievers & water dogs",
    basis: "registry",
  });
  assert.deepEqual(dogTypeLabel({ entity: { status: "canonical" }, editorialFamilies: ["sporting"] }), {
    label: "Sporting dogs",
    basis: "editorial",
  });
  assert.deepEqual(dogTypeLabel({ entity: { status: "historical" } }), {
    label: "Historical breed or type",
    basis: "catalog",
  });
});

test("Dog profile name matching is normalized but ambiguity fails closed", () => {
  const index = buildWikidataMatchIndex([
    { id: "Q1", label: "Great Dane", aliases: ["Deutsche Dogge"] },
    { id: "Q2", label: "Different Dog", aliases: ["Shared Name"] },
    { id: "Q3", label: "Other Dog", aliases: ["Shared Name"] },
  ]);
  assert.equal(normalizeProfileName("Great-Dane (dog breed)"), "great dane");
  assert.equal(uniqueWikidataMatch({ displayName: "Great Dane", aliases: [] }, index)?.id, "Q1");
  assert.equal(uniqueWikidataMatch({ displayName: "Shared Name", aliases: [] }, index), null);
});

test("generated Dog copy treats concept classes honestly", () => {
  const crossbreed = generatedProfileCopy({ displayName: "Example Cross", status: "crossbreed", aliases: [] });
  assert.match(crossbreed.summary, /vary widely/i);
  const historical = generatedProfileCopy({ displayName: "Old Dog", status: "historical", aliases: [] });
  assert.match(historical.summary, /historical/i);
  const variety = generatedProfileCopy({ displayName: "Small Example", status: "variety", aliases: [] }, { parentName: "Example Dog" });
  assert.match(variety.summary, /Example Dog/);
});

test("brief Dog profiles contain breed facts without editorial process or catalog filler", () => {
  for (const status of ["canonical", "variety", "crossbreed", "historical"]) {
    const copy = generatedProfileCopy({ displayName: "Example Dog", status, aliases: ["Other Name"] }, {
      origins: ["France", "Belgium"], parentName: "Parent Breed", packTitles: ["Example Pack"],
    });
    assert.match(copy.summary, /Example Dog/);
    assert.match(copy.summary, /France and Belgium/);
    assert.doesNotMatch(copy.summary, /StackRank|catalog|field note|researched|invented|Example Pack/);
    assert.equal(copy.interestingFact, "", "absence of a distinct fact must not become a filler callout");
  }
});

test("profile compiler covers every catalog entity and keeps popularity scoped", () => {
  const catalog = {
    source: { artifactUrl: "https://example.test/vbo.json", license: "CC BY 4.0", retrievedAt: "2026-01-01" },
    entities: [{ id: "VBO:0200610", displayName: "Golden Retriever", status: "canonical", aliases: [], relationships: {} }],
  };
  const profiles = buildDogProfiles({
    catalog,
    packs: { updatedAt: "2026-01-01", packs: [] },
    wikidata: { retrievedAt: "2026-01-01T00:00:00.000Z", source: { url: "https://query.wikidata.org", license: "CC0" }, records: [] },
    fci: { retrievedAt: "2026-01-01T00:00:00.000Z", source: { url: "https://www.fci.be" }, records: [] },
    overrides: { profiles: {} },
  });
  assert.deepEqual(Object.keys(profiles.profiles), ["VBO:0200610"]);
  assert.deepEqual(profiles.profiles["VBO:0200610"].popularity, {
    geography: "United States",
    year: 2025,
    rank: 3,
    total: 202,
    sourceId: "akc-us-registrations-2025",
  });
});

test("researched profiles preserve exact identities, primary origins and traceable review sources", () => {
  const id = "VBO:0200003";
  const input = {
    catalog: { source: {}, entities: [{ id, displayName: "Affenpinscher", status: "canonical", aliases: [] }] },
    packs: { updatedAt: "2026-09-22", packs: [] },
    wikidata: { source: {}, records: [{ id: "Q1", label: "Affenpinscher", countries: ["Unverified place"] }] },
    fci: { source: {}, records: [] },
    overrides: { profiles: {} },
  };
  const refresh = {
    schemaVersion: 1, reviewedAt: "2026-09-22", profiles: { [id]: {
      summary: "A sourced description of this specific breed, with its history and distinctive appearance.",
      sizeBand: "small", originRegions: ["Germany"],
      sources: [{ title: "Official breed standard", url: "https://example.test/186.pdf", evidence: "Origin: Germany." }],
    } },
  };
  const artifact = buildDogProfiles({ ...input, refreshes: [refresh] });
  const profile = artifact.profiles[id];
  assert.equal(profile.reviewStatus, "editor-reviewed");
  assert.deepEqual(profile.originRegions, ["Germany"]);
  assert.ok(profile.sourceIds.includes("stackrank-editorial-review-2026-09-22"));
  const reference = artifact.sources.find((source) => source.kind === "breed-reference");
  assert.equal(reference.url, "https://example.test/186.pdf");
  assert.match(reference.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "source IDs follow the published schema");
  assert.ok(profile.sourceIds.includes(reference.id));
  assert.throws(() => buildDogProfiles({ ...input, refreshes: [refresh, refresh] }), /Duplicate written profile/);
  const missingEvidence = structuredClone(refresh);
  missingEvidence.profiles[id].sources[0].evidence = "";
  assert.throws(() => buildDogProfiles({ ...input, refreshes: [missingEvidence] }), /traceable sources/);
  const wrongIdentity = { ...refresh, profiles: { "VBO:9999999": refresh.profiles[id] } };
  assert.throws(() => buildDogProfiles({ ...input, refreshes: [wrongIdentity] }), /Unknown refreshed profile/);
});
