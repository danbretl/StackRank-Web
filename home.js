import { localRankingCount } from "./lib/home-progress.js?v=1";

const countRanking = (storageKey, field = "items") => {
  try {
    const category = field === "movies" ? "movies" : "dogs";
    return localRankingCount({
      safetyRaw: localStorage.getItem(`stackrank:${category}:safety:v1`),
      authRaw: localStorage.getItem("sb-hrfhakrxsllrqmscxxpb-auth-token"),
      rawKey: storageKey,
      field,
    });
  } catch (_error) {
    // The family home is informational; corrupt category data stays isolated.
  }
  return 0;
};

const setProgress = (id, count, singular, plural = `${singular}s`) => {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = count
    ? `${count} ${count === 1 ? singular : plural} ranked on this device`
    : "No rankings on this device yet";
};

setProgress("home-movies-progress", countRanking("stackrank:movies:v1", "movies"), "movie");
setProgress(
  "home-dogs-progress",
  countRanking("stackrank:dogs:ranking:v1"),
  "breed or type",
  "breeds or types",
);
