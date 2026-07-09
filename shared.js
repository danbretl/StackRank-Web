import { createClient } from "./vendor/supabase-js-2.108.2.js?v=1";
import {
  normalizeSharedListPayload,
  sharedListSlugFromPath,
} from "./lib/share-link.js?v=1";
import {
  buildProductEvent,
  countBucket,
  shouldCollectProductTelemetry,
} from "./lib/telemetry.js?v=6";
import { formatRuntime } from "./lib/format.js?v=1";

const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const TMDB_DETAIL_POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_DETAIL_PATH = "/functions/v1/tmdb-detail";

const page = document.querySelector(".shared-page");
const title = document.getElementById("shared-title");
const subtitle = document.getElementById("shared-subtitle");
const meta = document.getElementById("shared-meta");
const status = document.getElementById("shared-status");
const grid = document.getElementById("shared-grid");
const detailOverlay = document.getElementById("shared-detail");
const detailClose = document.getElementById("shared-detail-close");
const detailPoster = document.getElementById("shared-detail-poster");
const detailRank = document.getElementById("shared-detail-rank");
const detailTitle = document.getElementById("shared-detail-title");
const detailSub = document.getElementById("shared-detail-sub");
const detailGenres = document.getElementById("shared-detail-genres");
const detailOverview = document.getElementById("shared-detail-overview");
const detailDirector = document.getElementById("shared-detail-director");
const detailCast = document.getElementById("shared-detail-cast");
const detailStatus = document.getElementById("shared-detail-status");
const detailCta = document.getElementById("shared-detail-cta");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
const detailCache = new Map();
const detailRequests = new Map();
let detailRequestId = 0;
let detailTrigger = null;
const productTelemetryEnabled = shouldCollectProductTelemetry({
  hostname: window.location.hostname,
  doNotTrack: navigator.doNotTrack || window.doNotTrack || "",
  globalPrivacyControl: navigator.globalPrivacyControl === true,
  debug: debugEnabled,
  automated: navigator.webdriver === true,
});
const productTelemetrySessionId =
  productTelemetryEnabled && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : null;

const setState = (state, message = "") => {
  if (page) page.dataset.sharedState = state;
  if (status) {
    status.hidden = state === "ready";
    status.textContent = message;
  }
  if (meta && message) meta.textContent = message;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const renderPoster = (movie) => {
  const frame = document.createElement("div");
  frame.className = "shared-card__poster";
  if (movie.posterPath) {
    const image = document.createElement("img");
    image.src = `${TMDB_POSTER_BASE}${movie.posterPath}`;
    image.alt = `${movie.title} poster`;
    image.loading = "lazy";
    frame.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = movie.title.slice(0, 1).toUpperCase();
    frame.appendChild(fallback);
    frame.classList.add("shared-card__poster--empty");
  }
  return frame;
};

const renderDetailPoster = (movie) => {
  detailPoster.innerHTML = "";
  detailPoster.classList.toggle("shared-detail__poster--empty", !movie.posterPath);
  if (movie.posterPath) {
    const image = document.createElement("img");
    image.src = `${TMDB_DETAIL_POSTER_BASE}${movie.posterPath}`;
    image.alt = `${movie.title} poster`;
    detailPoster.appendChild(image);
    return;
  }
  const fallback = document.createElement("span");
  fallback.textContent = movie.title.slice(0, 1).toUpperCase();
  detailPoster.appendChild(fallback);
};

const renderMovieDetail = ({ movie, rank, statusText = "" }) => {
  renderDetailPoster(movie);
  detailRank.textContent = rank ? `Ranked #${rank}` : "Shared movie";
  detailTitle.textContent = movie.title || "Movie";
  const subParts = [];
  if (movie.year) subParts.push(String(movie.year));
  const runtime = formatRuntime(movie.runtime);
  if (runtime) subParts.push(runtime);
  detailSub.textContent = subParts.join(" - ") || "Details unavailable";
  detailGenres.textContent = Array.isArray(movie.genres) && movie.genres.length ? movie.genres.join(", ") : "";
  detailOverview.textContent = movie.overview || "No overview available yet.";
  detailDirector.textContent = movie.director || "Unknown";
  detailCast.textContent = Array.isArray(movie.cast) && movie.cast.length ? movie.cast.join(", ") : "Unknown";
  detailStatus.textContent = statusText;
  detailCta.setAttribute("aria-label", `Rank ${movie.title} in your own movie ranking`);
};

const fetchMovieDetail = async (movie) => {
  if (!movie?.tmdbId) return null;
  const cacheKey = String(movie.tmdbId);
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);
  if (detailRequests.has(cacheKey)) return detailRequests.get(cacheKey);
  const request = (async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}${TMDB_DETAIL_PATH}?id=${encodeURIComponent(movie.tmdbId)}`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.result) return null;
      const detail = { ...movie, ...data.result };
      detailCache.set(cacheKey, detail);
      return detail;
    } catch (error) {
      if (debugEnabled) console.warn("Could not load movie details", error);
      return null;
    } finally {
      detailRequests.delete(cacheKey);
    }
  })();
  detailRequests.set(cacheKey, request);
  return request;
};

const closeMovieDetail = ({ restoreFocus = true } = {}) => {
  detailRequestId += 1;
  detailOverlay.hidden = true;
  document.body.classList.remove("is-shared-detail-open");
  if (restoreFocus && detailTrigger) detailTrigger.focus();
  detailTrigger = null;
};

const openMovieDetail = async ({ movie, rank, trigger }) => {
  const requestId = ++detailRequestId;
  detailTrigger = trigger instanceof HTMLElement ? trigger : null;
  renderMovieDetail({
    movie,
    rank,
    statusText: movie.tmdbId ? "Loading details..." : "More details unavailable.",
  });
  detailOverlay.hidden = false;
  document.body.classList.add("is-shared-detail-open");
  detailClose.focus({ preventScroll: true });
  const detail = await fetchMovieDetail(movie);
  if (requestId !== detailRequestId || detailOverlay.hidden) return;
  renderMovieDetail({
    movie: detail || movie,
    rank,
    statusText: detail ? "" : movie.tmdbId ? "Could not load full details." : "More details unavailable.",
  });
};

const renderSharedList = ({ payload, updatedAt }) => {
  const displayName = payload.displayName ? `${payload.displayName}'s movie ranking` : "Shared movie ranking";
  title.textContent = displayName;
  subtitle.textContent =
    "A read-only StackRank snapshot. It only changes when the owner updates this link.";
  const dateLabel = formatDate(updatedAt);
  meta.textContent = `${payload.movies.length} ranked movie${payload.movies.length === 1 ? "" : "s"}${
    dateLabel ? ` - Snapshot updated ${dateLabel}` : ""
  }`;

  grid.innerHTML = "";
  payload.movies.forEach((movie, index) => {
    const card = document.createElement("article");
    card.className = "shared-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open details for #${index + 1}, ${movie.title}`);

    const rank = document.createElement("div");
    rank.className = "shared-card__rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("div");
    copy.className = "shared-card__copy";
    const name = document.createElement("h2");
    name.textContent = movie.title;
    const year = document.createElement("p");
    year.textContent = movie.year ? String(movie.year) : "Year unknown";
    copy.append(name, year);

    card.append(rank, renderPoster(movie), copy);
    card.addEventListener("click", () => openMovieDetail({ movie, rank: index + 1, trigger: card }));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openMovieDetail({ movie, rank: index + 1, trigger: card });
    });
    grid.appendChild(card);
  });

  setState("ready");
  trackSharedListViewed(payload.movies.length);
};

const trackSharedListViewed = (movieCount) => {
  if (!productTelemetryEnabled || !productTelemetrySessionId) return;
  const payload = buildProductEvent({
    eventName: "shared_list_viewed",
    sessionId: productTelemetrySessionId,
    properties: {
      list_size: countBucket(movieCount),
      signed_in: false,
    },
  });
  if (!payload) return;
  void supabase
    .from("product_events")
    .insert(payload)
    .then(({ error }) => {
      if (error && debugEnabled) console.warn("Could not record shared-list view", error);
    })
    .catch((error) => {
      if (debugEnabled) console.warn("Could not record shared-list view", error);
    });
};

const loadSharedList = async () => {
  const slug = sharedListSlugFromPath(window.location.pathname);
  if (!slug) {
    setState("missing", "This shared list link is not valid.");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("shared_lists")
      .select("payload, updated_at")
      .eq("slug", slug)
      .eq("revoked", false)
      .maybeSingle();
    if (error) throw error;
    const payload = normalizeSharedListPayload(data?.payload);
    if (!data || !payload.movies.length) {
      setState("missing", "This shared list is no longer available.");
      return;
    }
    renderSharedList({ payload, updatedAt: data.updated_at });
  } catch (error) {
    console.warn("Could not load shared list", error);
    setState("error", "Could not load this shared list. Try again later.");
  }
};

detailClose.addEventListener("click", () => closeMovieDetail());
detailOverlay.addEventListener("click", (event) => {
  if (event.target === detailOverlay) closeMovieDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && detailOverlay && !detailOverlay.hidden) {
    event.preventDefault();
    closeMovieDetail();
  }
});

loadSharedList();
