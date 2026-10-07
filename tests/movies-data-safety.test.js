import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durableMovieLists, appendRecoveredMovies, validRemoteMovies, validMovieStoredPayload } from '../lib/movies-data-safety.js';
import { buildStackRankBackup, parseStackRankBackup } from '../lib/backup.js';

const a = { title: 'One', tmdbId: 1, rankedAt: '2026-01-01' };
const b = { title: 'Two', tmdbId: 2 };
const c = { title: 'Three', tmdbId: 3 };
test('a re-ranking draft retains the exact durable origin and unrelated edits', () => {
  const active = [a, c];
  const result = durableMovieLists({ ranking: active, pendingOrigin: { type: 'ranking', movie: b, index: 1 } });
  assert.deepEqual(result.ranking, [a, b, c]);
  assert.deepEqual(active, [a, c]);
  assert.deepEqual(durableMovieLists({ ranking: [c, b, a] }).ranking, [c, b, a]);
});
test('queue draft keeps saved metadata and cannot duplicate an already restored origin', () => {
  const queued = { ...b, savedAt: '2026-10-01' };
  for (const [type, field] of [['watch', 'watchList'], ['notInterested', 'notInterestedList']]) {
    const origin = { type, movie: queued, index: 1 };
    assert.deepEqual(durableMovieLists({ [field]: [a, c], pendingOrigin: origin })[field], [a, queued, c]);
    assert.deepEqual(durableMovieLists({ [field]: [a, queued, c], pendingOrigin: origin })[field], [a, queued, c]);
  }
});
test('explicit recovery appends new identities without taking over account order', () => {
  assert.deepEqual(appendRecoveredMovies([c, a], [b, a, b]), [c, a, b]);
});
test('unreadable remote rows are distinct from valid empty lists', () => {
  assert.equal(validRemoteMovies([]), true);
  assert.equal(validRemoteMovies([a, { year: 2000 }]), false);
  assert.equal(validRemoteMovies(null), false);
  assert.equal(validRemoteMovies([{ title: 'Legacy without provider id' }]), true);
});
test('backup identity normalization reports bounded title and year changes before restore', () => {
  const backup = buildStackRankBackup({ ranking: [{ title: 'x'.repeat(320), year: 1865 }, { nope: true }] });
  const restored = parseStackRankBackup(JSON.stringify(backup));
  assert.equal(restored.ranking.length, 1);
  assert.equal(restored.warnings.length, 3);
  assert.match(restored.warnings.join(' '), /shortened/);
  assert.equal(backup.ranking[0].year, 1865);
});
test('syntactically valid but unsupported owner payloads are quarantined', () => {
  assert.equal(validMovieStoredPayload('ranking', { movies: 'broken' }), false);
  assert.equal(validMovieStoredPayload('ranking', [null]), false);
  assert.equal(validMovieStoredPayload('ranking', [a]), true);
  assert.equal(validMovieStoredPayload('queues', { watchList: [], notInterestedList: [null] }), false);
  assert.equal(validMovieStoredPayload('packs', { progress: { pack: null } }), false);
  assert.equal(validMovieStoredPayload('packs', { progress: {} }), true);
});
