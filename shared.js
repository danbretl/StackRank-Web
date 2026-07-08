import { createClient } from "./vendor/supabase-js-2.108.2.js?v=1";
import {
  normalizeSharedListPayload,
  sharedListSlugFromPath,
} from "./lib/share-link.js?v=1";
import {
  buildProductEvent,
  countBucket,
  shouldCollectProductTelemetry,
} from "./lib/telemetry.js?v=5";

const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";

const page = document.querySelector(".shared-page");
const title = document.getElementById("shared-title");
const subtitle = document.getElementById("shared-subtitle");
const meta = document.getElementById("shared-meta");
const status = document.getElementById("shared-status");
const grid = document.getElementById("shared-grid");

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
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

const renderSharedList = ({ payload, updatedAt }) => {
  const displayName = payload.displayName ? `${payload.displayName}'s movie stack` : "Shared movie stack";
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

loadSharedList();
