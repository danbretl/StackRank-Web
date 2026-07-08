export const STARTER_PACK_SLUGS = Object.freeze([
  "fan-favorites-letterboxd-core",
  "studio-ghibli-gateways",
  "black-cinema-essentials",
]);

export const BACKUP_NUDGE_RANKING_INTERVAL = 25;
export const BACKUP_NUDGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const nonNegativeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const parseBackupNudgeState = (raw) => {
  if (!raw) return { lastShownAt: 0, lastRankingCount: 0 };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      lastShownAt: nonNegativeNumber(parsed?.lastShownAt),
      lastRankingCount: Math.floor(nonNegativeNumber(parsed?.lastRankingCount)),
    };
  } catch (_error) {
    return { lastShownAt: 0, lastRankingCount: 0 };
  }
};

export const shouldShowBackupNudge = ({
  rankingLength = 0,
  signedIn = false,
  localPersistenceUnavailable = false,
  state = {},
  now = Date.now(),
  interval = BACKUP_NUDGE_RANKING_INTERVAL,
  cooldownMs = BACKUP_NUDGE_COOLDOWN_MS,
} = {}) => {
  if (signedIn) return { show: false, reason: null, rankingCount: 0 };
  const count = Math.max(0, Math.floor(Number(rankingLength) || 0));
  const safeInterval = Math.max(1, Math.floor(Number(interval) || 1));
  const safeCooldownMs = Math.max(0, Number(cooldownMs) || 0);
  const lastShownAt = nonNegativeNumber(state.lastShownAt);
  const lastRankingCount = Math.floor(nonNegativeNumber(state.lastRankingCount));
  const currentTime = nonNegativeNumber(now);
  const cooledDown = !lastShownAt || currentTime - lastShownAt >= safeCooldownMs;

  if (localPersistenceUnavailable) {
    return {
      show: cooledDown,
      reason: cooledDown ? "storage_unavailable" : null,
      rankingCount: count,
    };
  }

  const threshold = Math.floor(count / safeInterval) * safeInterval;
  if (threshold < safeInterval || threshold <= lastRankingCount || !cooledDown) {
    return { show: false, reason: null, rankingCount: threshold };
  }

  return {
    show: true,
    reason: "ranking_count",
    rankingCount: threshold,
  };
};

export const nextBackupNudgeState = ({
  state = {},
  decision = {},
  now = Date.now(),
} = {}) => ({
  lastShownAt: nonNegativeNumber(now),
  lastRankingCount: Math.max(
    Math.floor(nonNegativeNumber(state.lastRankingCount)),
    Math.floor(nonNegativeNumber(decision.rankingCount)),
  ),
});

export const getFirstRunExperience = (rankingLength) => {
  const count = Math.max(0, Math.floor(Number(rankingLength) || 0));
  if (count === 0) {
    return {
      state: "empty",
      visible: true,
      eyebrow: "How StackRank works",
      title: "Add two movies. Pick the one you prefer.",
      body: "Search above, start a pack below, or import an ordered list.",
      showImport: true,
    };
  }
  if (count === 1) {
    return {
      state: "one",
      visible: true,
      eyebrow: "First movie ranked",
      title: "Add one more to start comparing.",
      body: "Search above or pick one from a pack below.",
      showImport: false,
    };
  }
  return {
    state: "established",
    visible: false,
    eyebrow: "",
    title: "",
    body: "",
    showImport: false,
  };
};

export const selectStarterPacks = (
  packs,
  { preferredSlugs = STARTER_PACK_SLUGS, limit = 3 } = {},
) => {
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!safeLimit || !Array.isArray(packs)) return [];

  const eligible = packs.filter(
    (pack) =>
      pack &&
      pack.active !== false &&
      typeof pack.slug === "string" &&
      pack.slug &&
      Array.isArray(pack.movies) &&
      pack.movies.length,
  );
  const bySlug = new Map(eligible.map((pack) => [pack.slug, pack]));
  const selected = [];
  const selectedSlugs = new Set();

  preferredSlugs.forEach((slug) => {
    const pack = bySlug.get(slug);
    if (!pack || selectedSlugs.has(slug) || selected.length >= safeLimit) return;
    selected.push(pack);
    selectedSlugs.add(slug);
  });

  eligible
    .slice()
    .sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        a.title.localeCompare(b.title),
    )
    .forEach((pack) => {
      if (selected.length >= safeLimit || selectedSlugs.has(pack.slug)) return;
      selected.push(pack);
      selectedSlugs.add(pack.slug);
    });

  return selected;
};
