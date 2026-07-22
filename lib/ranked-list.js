import { entityRefKey, mergeEntityRankings } from "./entity.js?v=1";

const emptyPayload = () => ({ items: [], updated_at: null });

const timestampValue = (value) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export function parseRankedListPayload(raw) {
  if (typeof raw !== "string" || !raw) return emptyPayload();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, updated_at: null };
    if (parsed && Array.isArray(parsed.items)) {
      return {
        items: parsed.items,
        updated_at: parsed.updated_at || null,
      };
    }
  } catch (_error) {
    // Corrupt convenience storage must not prevent the category from booting.
  }
  return emptyPayload();
}

export function serializeRankedListPayload(items, updatedAt = new Date().toISOString()) {
  return JSON.stringify({
    items: Array.isArray(items) ? items : [],
    updated_at: updatedAt,
  });
}

export function mergeRankedListPayloads(payloads = []) {
  const sorted = (Array.isArray(payloads) ? payloads : [])
    .map((payload) => ({
      items: Array.isArray(payload?.items) ? payload.items : [],
      updated_at: payload?.updated_at || null,
    }))
    .sort(
      (a, b) => timestampValue(b.updated_at) - timestampValue(a.updated_at),
    );
  const [newest = emptyPayload(), ...older] = sorted;
  const appendedItems = [];
  const seen = new Set(newest.items.map(entityRefKey).filter(Boolean));
  const items = older.reduce((merged, payload) => {
    payload.items.forEach((item) => {
      const key = entityRefKey(item);
      if (key && !seen.has(key)) appendedItems.push(item);
      if (key) seen.add(key);
    });
    return mergeEntityRankings(merged, payload.items);
  }, newest.items);
  return { items, updated_at: newest.updated_at, appendedItems };
}
