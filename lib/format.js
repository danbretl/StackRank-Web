// Pure display formatters shared by the app and the test suite. No DOM, no
// globals — anything stateful (e.g. runtime totals that read the detail cache)
// stays in app.js and passes plain values into these.

export function formatRuntime(runtime) {
  if (!runtime) return "";
  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatRuntimeTotal(minutes) {
  if (!minutes) return "--";
  return formatRuntime(minutes);
}

// Given accumulated { minutes } for a queue and its movie count, decide what the
// share poster should show: a real duration, a "Loading"/"Unavailable" hint, or
// a dash when the queue is empty.
export function formatShareRuntimeTotal(stats, totalCount, loading = false) {
  if (stats.minutes) {
    return { value: formatRuntime(stats.minutes), isDuration: true };
  }
  if (totalCount && loading) {
    return { value: "Loading", isDuration: false };
  }
  if (totalCount) {
    return { value: "Unavailable", isDuration: false };
  }
  return { value: "--", isDuration: false };
}

export function decadeLabel(decade) {
  return `${decade}s`;
}

export function rankedCountLabel(count) {
  return `${count} ranked`;
}

// ISO day (YYYY-MM-DD) for grouping rank timestamps; null on bad input.
export function dayKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
