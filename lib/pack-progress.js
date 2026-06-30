const timestampValue = (value) => {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const isObjectRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function stripPackProgressMetadata(entry = {}) {
  const source = isObjectRecord(entry) ? entry : {};
  const {
    startedAt = null,
    packVersionSeen = null,
    lastIndex = 0,
    completedAt = null,
    discoveryDismissedAt = null,
  } = source;
  return {
    startedAt,
    packVersionSeen,
    lastIndex: Number.isFinite(Number(lastIndex)) ? Number(lastIndex) : 0,
    completedAt,
    discoveryDismissedAt,
  };
}

export function normalizePackProgressEntry(entry = {}, updatedAt = null) {
  const source = isObjectRecord(entry) ? entry : {};
  return {
    ...stripPackProgressMetadata(source),
    updated_at: source.updated_at || updatedAt || null,
  };
}

export function parsePackProgressPayload(raw) {
  if (typeof raw !== "string" || !raw) return { progress: {} };
  const parsed = JSON.parse(raw);
  return {
    progress: isObjectRecord(parsed?.progress) ? parsed.progress : {},
  };
}

export function mergePackProgressPayloads(payloads = []) {
  const merged = {};
  (Array.isArray(payloads) ? payloads : []).forEach((payload) => {
    if (!isObjectRecord(payload?.progress)) return;
    Object.entries(payload.progress).forEach(([slug, entry]) => {
      if (!slug || !isObjectRecord(entry)) return;
      const current = merged[slug];
      const entryTime = timestampValue(entry.updated_at);
      const currentTime = timestampValue(current?.updated_at);
      if (!current || entryTime >= currentTime) {
        merged[slug] = normalizePackProgressEntry(entry);
      }
    });
  });
  return merged;
}
