import { normalizeCatalogSearchText } from './catalog.js?v=1';

// Entries are supplied only after the completed-profile/artwork gate in dogs.js.
export function filterDogGallery(entries, { query = '', family = '', status = '' } = {}) {
  const words = normalizeCatalogSearchText(query).split(' ').filter(Boolean);
  return entries.filter((entry) => {
    if (family && entry.family !== family) return false;
    if (status === 'unranked' ? entry.location === 'ranking' : status && entry.location !== status) return false;
    const haystack = normalizeCatalogSearchText([entry.name, ...(entry.aliases || [])].join(' '));
    return words.every((word) => haystack.includes(word));
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export function dogGalleryPage(entries, page = 0, pageSize = 24) {
  const size = Math.max(1, Math.floor(Number(pageSize) || 24));
  const pages = Math.max(1, Math.ceil(entries.length / size));
  const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
  return { items: entries.slice(index * size, (index + 1) * size), page: index, pages,
    start: entries.length ? index * size + 1 : 0, end: Math.min(entries.length, (index + 1) * size), total: entries.length };
}
