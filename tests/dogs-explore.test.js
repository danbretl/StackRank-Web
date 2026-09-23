import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDogGallery, dogGalleryPage } from '../lib/dogs-explore.js';

const entries = [
  { id: 'a', name: 'Shiba Inu', aliases: ['Japanese Shiba'], family: 'Spitz', location: 'ranking' },
  { id: 'b', name: 'Épagneul Breton', aliases: ['Brittany'], family: 'Gundogs', location: 'curious' },
  { id: 'c', name: 'Akita', aliases: ['Akita Inu'], family: 'Spitz', location: '' },
];
test('gallery searches aliases and accents, and combines family/status filters', () => {
  assert.deepEqual(filterDogGallery(entries, { query: 'epagneul' }).map(x => x.id), ['b']);
  assert.deepEqual(filterDogGallery(entries, { query: 'brittany' }).map(x => x.id), ['b']);
  assert.deepEqual(filterDogGallery(entries, { query: 'inu', family: 'Spitz', status: 'unranked' }).map(x => x.id), ['c']);
  assert.deepEqual(filterDogGallery(entries, { status: 'curious' }).map(x => x.id), ['b']);
  assert.equal(filterDogGallery(entries, { query: 'missing' }).length, 0);
  assert.equal(entries[0].id, 'a', 'filtering must not sort the supplied catalog in place');
});
test('gallery clamps pages after filtering and retains all catalog entries across pages', () => {
  const all = Array.from({ length: 307 }, (_, id) => ({ id }));
  const last = dogGalleryPage(all, 99);
  assert.deepEqual([last.page, last.pages, last.start, last.end, last.items.length], [12, 13, 289, 307, 19]);
  const seen = Array.from({ length: 13 }, (_, page) => dogGalleryPage(all, page).items).flat();
  assert.deepEqual(seen, all);
  assert.deepEqual(dogGalleryPage([], 12), { items: [], page: 0, pages: 1, start: 0, end: 0, total: 0 });
  assert.equal(dogGalleryPage(entries, 12).page, 0);
  assert.equal(dogGalleryPage(entries, -1).page, 0);
});
