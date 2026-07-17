const countRanking = (storageKey, field = "items") => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (Array.isArray(parsed?.[field])) return parsed[field].length;
    if (field === "movies" && Array.isArray(parsed?.items)) return parsed.items.length;
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
