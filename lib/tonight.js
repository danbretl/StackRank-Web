// "Pick something for tonight" — pure candidate scoring and slate selection.
//
// DOM-free. The app gathers the Watch next queue, per-movie facts (runtime /
// genres / mood fit, enriched by the tonight-pick edge function or the detail
// cache as a fallback), and the rank-weighted insights object, then calls
// `buildTonightSlate` to get up to three scored, explained picks. Nothing here
// persists a choice on the user's behalf, and no TMDB ratings are consulted —
// taste weighting comes entirely from where movies sit in the user's ranking.

import { formatRuntime } from "./format.js?v=1";
import { movieYear } from "./movie.js?v=1";

export const TONIGHT_SLATE_SIZE = 3;

// Time windows are inclusive-feeling bands with soft edges: a 97-minute movie
// still mostly "fits" Under 90m. `min`/`max` are the comfortable band;
// `slack` is how far outside it a runtime can drift before scoring zero.
export const TONIGHT_TIME_WINDOWS = Object.freeze([
  { id: "any", label: "Any length" },
  { id: "short", label: "Under 90m", max: 90, slack: 25 },
  { id: "standard", label: "Around 2h", min: 85, max: 140, slack: 30 },
  { id: "long", label: "Over 2½h", min: 150, slack: 35 },
]);

export const DEFAULT_TONIGHT_WINDOW = "any";

export function normalizeTonightWindow(id) {
  return TONIGHT_TIME_WINDOWS.some((window) => window.id === id) ? id : DEFAULT_TONIGHT_WINDOW;
}

// 0..1 fit of a runtime inside a window; unknown runtimes score a neutral 0.45
// so missing TMDB data doesn't bury a movie, it just can't win on fit.
export function runtimeFitScore(runtime, windowId) {
  const window = TONIGHT_TIME_WINDOWS.find((entry) => entry.id === normalizeTonightWindow(windowId));
  if (!window || window.id === "any") return 0.75;
  const minutes = Number(runtime);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0.45;
  const slack = window.slack || 25;
  const below = window.min ? window.min - minutes : 0;
  const above = window.max ? minutes - window.max : 0;
  const overshoot = Math.max(below, above, 0);
  if (overshoot === 0) return 1;
  return Math.max(0, 1 - overshoot / slack);
}

const normalized = (value) => String(value || "").trim().toLocaleLowerCase();

// Convert the insights object's rank-weighted aggregates into 0..1 lookup maps
// (top signal → 1, everything else scaled against it).
export function tonightTasteProfile(insights = {}) {
  const toMap = (items = []) => {
    const top = Number(items[0]?.score) || 0;
    const map = new Map();
    if (top <= 0) return map;
    items.forEach((item) => {
      if (item?.name) map.set(normalized(item.name), Math.max(0, Number(item.score) || 0) / top);
    });
    return map;
  };
  return {
    genres: toMap(insights.genres),
    directors: toMap(insights.directors),
    cast: toMap(insights.cast),
  };
}

// Rank-weighted taste affinity for one candidate: best genre signal carries
// most of it, with director/cast bonuses. Returns the score plus the concrete
// signals so reasons can cite them.
export function tasteAffinity(facts = {}, profile) {
  const genreScores = (facts.genres || [])
    .map((genre) => ({ genre, value: profile.genres.get(normalized(genre)) || 0 }))
    .sort((a, b) => b.value - a.value);
  const bestGenre = genreScores[0] && genreScores[0].value > 0 ? genreScores[0] : null;
  const secondGenre = genreScores[1] && genreScores[1].value > 0 ? genreScores[1] : null;
  const directorValue = profile.directors.get(normalized(facts.director)) || 0;
  const castEntry = (facts.cast || [])
    .map((name) => ({ name, value: profile.cast.get(normalized(name)) || 0 }))
    .sort((a, b) => b.value - a.value)[0];
  const castValue = castEntry?.value || 0;

  const score = Math.min(
    1,
    (bestGenre?.value || 0) * 0.6 +
      (secondGenre?.value || 0) * 0.1 +
      directorValue * 0.35 +
      castValue * 0.2,
  );
  return {
    score,
    genre: bestGenre && bestGenre.value >= 0.35 ? bestGenre.genre : null,
    director: directorValue >= 0.4 ? facts.director : null,
    castName: castValue >= 0.4 ? castEntry.name : null,
  };
}

// Small deterministic jitter so reshuffles reorder near-ties without making
// results untestable: hash(seed, tmdbId) → -0.02..0.02.
export function tonightJitter(seed, tmdbId) {
  let hash = 2166136261;
  const text = `${seed}:${tmdbId}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000 * 0.04 - 0.02;
}

const monthsSince = (isoDate, now) => {
  const time = new Date(isoDate || "").getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, (now - time) / (1000 * 60 * 60 * 24 * 30));
};

export function buildTonightReasons(entry, { windowId, moodApplied }) {
  const reasons = [];
  const { facts, taste, moodMatches, savedMonths } = entry;
  const runtimeText = formatRuntime(facts.runtime);
  const window = TONIGHT_TIME_WINDOWS.find((item) => item.id === normalizeTonightWindow(windowId));

  if (moodApplied && entry.moodScore >= 0.25) {
    const signals = [
      ...(moodMatches?.senses || []),
      ...(moodMatches?.keywords || []).map((keyword) => keyword.toLocaleLowerCase()),
      ...(moodMatches?.era ? [moodMatches.era] : []),
    ];
    const unique = [...new Set(signals)].slice(0, 3);
    if (unique.length) reasons.push(`Matches your vibe — ${unique.join(", ")}`);
  }
  if (taste.genre) reasons.push(`You rank ${taste.genre.toLocaleLowerCase()} high`);
  if (taste.director) reasons.push(`Directed by ${taste.director}, a favorite of yours`);
  else if (taste.castName) reasons.push(`${taste.castName} sits near the top of your list`);
  if (runtimeText) {
    if (window && window.id !== "any" && entry.runtimeScore >= 0.99) {
      reasons.push(`Fits your window at ${runtimeText}`);
    } else {
      reasons.push(runtimeText);
    }
  }
  if (reasons.length < 3 && savedMonths !== null && savedMonths >= 1.5) {
    reasons.push("Waiting in Watch next for a while");
  }
  if (!reasons.length) reasons.push("From your Watch next queue");
  return reasons.slice(0, 3);
}

// Score every queue candidate. `facts` maps tmdbId → enrichment (runtime,
// genres, director, cast, moodScore, moodMatches). Weights shift depending on
// whether a mood was readable and whether a time window narrows the night.
export function scoreTonightCandidates({
  queue = [],
  facts = new Map(),
  insights = {},
  windowId = DEFAULT_TONIGHT_WINDOW,
  moodApplied = false,
  seed = 0,
  now = Date.now(),
} = {}) {
  const profile = tonightTasteProfile(insights);
  const window = normalizeTonightWindow(windowId);
  const windowActive = window !== "any";
  const weights = moodApplied
    ? { mood: 0.38, taste: 0.3, runtime: windowActive ? 0.22 : 0.1, fresh: 0.1 }
    : { mood: 0, taste: 0.55, runtime: windowActive ? 0.3 : 0.15, fresh: 0.15 };

  return queue
    .filter((movie) => movie && movie.tmdbId)
    .map((movie) => {
      const enrichment = facts.get(movie.tmdbId) || facts.get(String(movie.tmdbId)) || {};
      const combined = { ...movie, ...enrichment, year: movieYear(enrichment) || movieYear(movie) };
      const taste = tasteAffinity(combined, profile);
      const runtimeScore = runtimeFitScore(combined.runtime, window);
      const moodScore = moodApplied ? Number(enrichment.moodScore) || 0 : 0;
      const savedMonths = monthsSince(movie.savedAt || movie.queuedAt, now);
      // Older saves get a mild boost so long-waiting movies resurface.
      const freshScore = savedMonths === null ? 0.4 : Math.min(1, 0.35 + savedMonths / 6);
      const score =
        moodScore * weights.mood +
        taste.score * weights.taste +
        runtimeScore * weights.runtime +
        freshScore * weights.fresh +
        tonightJitter(seed, movie.tmdbId);
      const entry = {
        movie,
        facts: combined,
        score,
        taste,
        runtimeScore,
        moodScore,
        moodMatches: enrichment.moodMatches || null,
        savedMonths,
      };
      entry.reasons = buildTonightReasons(entry, { windowId: window, moodApplied });
      return entry;
    })
    .sort((a, b) => b.score - a.score);
}

// Pick the top slate with a light diversity guard: a candidate whose lead
// genre already appears twice in the slate can be passed over for a
// close-scoring alternative. `excludeIds` supports "show different picks".
export function pickTonightSlate(entries, { count = TONIGHT_SLATE_SIZE, excludeIds = new Set() } = {}) {
  const available = entries.filter((entry) => !excludeIds.has(entry.movie.tmdbId));
  const slate = [];
  const leadGenreCounts = new Map();
  // Fresh (not-yet-shown) candidates first; backfill from already-shown ones
  // only when exclusions leave the slate short.
  const remaining = [
    ...available,
    ...entries.filter((entry) => excludeIds.has(entry.movie.tmdbId)),
  ];
  while (slate.length < count && remaining.length) {
    let pickIndex = 0;
    const lead = normalized(remaining[0]?.facts?.genres?.[0]);
    if (lead && (leadGenreCounts.get(lead) || 0) >= 2) {
      const alternative = remaining.findIndex(
        (entry, index) =>
          index > 0 &&
          normalized(entry.facts?.genres?.[0]) !== lead &&
          remaining[0].score - entry.score <= 0.08,
      );
      if (alternative > 0) pickIndex = alternative;
    }
    const [picked] = remaining.splice(pickIndex, 1);
    slate.push(picked);
    const pickedLead = normalized(picked.facts?.genres?.[0]);
    if (pickedLead) leadGenreCounts.set(pickedLead, (leadGenreCounts.get(pickedLead) || 0) + 1);
  }
  return slate;
}

// One-call convenience for the app: score, pick, and describe the slate.
export function buildTonightSlate(options = {}) {
  const entries = scoreTonightCandidates(options);
  const slate = pickTonightSlate(entries, {
    count: options.count || TONIGHT_SLATE_SIZE,
    excludeIds: options.excludeIds || new Set(),
  });
  return { entries, slate };
}

// Status line describing how the vibe was read, shown above the picks.
export function tonightMoodSummary(mood, { moodUnavailable = false } = {}) {
  if (moodUnavailable) return "Vibe matching is unavailable right now — picked from your taste instead.";
  if (!mood) return "";
  if (!mood.readable) return "Couldn’t read that vibe — leaning on your taste instead.";
  const parts = [...(mood.recognized || [])];
  if (mood.era) parts.push(mood.era);
  if (!parts.length) return "";
  return `Vibe read as ${parts.slice(0, 4).join(" · ")}.`;
}
