import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDogProfiles } from '../scripts/dog-profiles-lib.mjs';
import { normalizeDogProfile, dogProfilePresentationLabel } from '../lib/dogs.js';

const id = 'VBO:0200001';
const source = { url: 'https://example.test/parentage', title: 'Recorded parentage', evidence: 'The original record identifies both parents. No behavior is inferred.' };
const input = fields => ({
  catalog: { source: { artifactUrl: 'https://example.test/vbo', license: 'CC BY 4.0', retrievedAt: '2026-10-06' }, entities: [{ id, displayName: 'Example cross', status: 'crossbreed', aliases: ['Other name'] }] },
  packs: { updatedAt: '2026-10-06', packs: [] }, wikidata: { records: [], source: {}, retrievedAt: '2026-10-06' }, fci: { records: [], source: {} }, overrides: { profiles: {} },
  refreshes: [{ schemaVersion: 1, reviewedAt: '2026-10-06', profiles: { [id]: {
    profileForm: 'concise', summary: 'A recorded cross.', shortDescription: 'A recorded cross.', interestingFact: '', sources: [source], ...fields,
  } } }],
});

test('reviewed concise copy can be short and identical without invented facts or padding', () => {
  const document = buildDogProfiles(input({}));
  const profile = document.profiles[id];
  assert.equal(profile.summary, 'A recorded cross.');
  assert.equal(profile.shortDescription, profile.summary);
  assert.equal(profile.interestingFact, '');
  assert.equal(profile.reviewStatus, 'editor-reviewed');
  assert.equal(normalizeDogProfile(profile).summary, profile.summary);
  assert.ok(document.sources.some(row => row.kind === 'breed-reference'));
});

test('concise mode does not allow absent evidence, blank copy, or unknown forms', () => {
  for (const fields of [{ summary: ' ' }, { shortDescription: '' }, { sources: [] }, { profileForm: 'unchecked' }]) {
    assert.throws(() => buildDogProfiles(input(fields)), /Concise profile|traceable sources|Invalid authored profile/);
  }
  assert.equal(normalizeDogProfile({ summary: 'A recorded cross.', profileForm: 'unchecked', sizeBand: 'unknown' }), null);
});

test('category scope survives normalization and openly labels its representative portrait', () => {
  const profile = buildDogProfiles(input({ identityScope: 'category', typeLabel: 'Breed group', portraitExample: 'Named member', evidenceNote: 'The group has several independently defined member breeds.' })).profiles[id];
  const normalized = normalizeDogProfile(profile);
  assert.equal(normalized.identityScope, 'category');
  assert.equal(normalized.portraitExample, 'Named member');
  assert.match(normalized.evidenceNote, /several/);
  assert.equal(dogProfilePresentationLabel(normalized), 'Breed group · illustrative example: Named member');
  assert.throws(() => buildDogProfiles(input({ identityScope: 'category' })), /explicit type label/);
  assert.throws(() => buildDogProfiles(input({ portraitExample: 'Member without a category' })), /Invalid category portrait/);
});

test('explicit concise metadata does not regain pack families or generated fact filler', () => {
  const data = input({ editorialFamilies: [], interestingFact: '', originRegions: [] });
  data.packs.packs = [{ title: 'Working dogs', family: 'herding', items: [id] }];
  const profile = buildDogProfiles(data).profiles[id];
  assert.deepEqual(profile.editorialFamilies, []);
  assert.deepEqual(profile.originRegions, []);
  assert.equal(profile.interestingFact, '');
});
