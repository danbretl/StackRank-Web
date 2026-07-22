// Movies is the compatibility category: these values intentionally preserve
// every customer-visible route, label, and browser-storage key used by the
// existing app. New categories use namespaced defaults from lib/category.js.

export const MOVIES_CATEGORY = Object.freeze({
  id: "movies",
  path: "/movies",
  // The root is the intentional local-development entry, while the GitHub
  // Pages sub-path remains a temporary browser-data recovery route.
  documentPathAliases: Object.freeze(["/", "/StackRank-Web"]),
  labels: Object.freeze({
    singular: "movie",
    plural: "movies",
    savedList: "Watch next",
    hiddenList: "Not for me",
    artwork: "poster",
  }),
  provider: Object.freeze({
    id: "tmdb",
    name: "TMDB",
  }),
  artwork: Object.freeze({ aspectRatio: 2 / 3 }),
  exportFilePrefix: "stackrank-movies",
  storage: Object.freeze({
    ranking: "stackrank:movies:v1",
    queues: "stackrank:suggestion-queues:v1",
    packProgress: "stackrank:pack-progress:v1",
    backupNudge: "stackrank:backup-nudge:v1",
    shareOptions: "stackrank:share-options:v1",
    rankingView: "stackrank:ranking-view:v1",
    appDestination: "stackrank:app-destination:v1",
    suggestionSeed: "stackrank:inspired-seed:v1",
  }),
});
