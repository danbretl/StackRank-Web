import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.info("StackRank build", "feedback-v1");

const form = document.getElementById("movie-form");
const titleInput = document.getElementById("title");
const suggestions = document.getElementById("suggestions");
const apiStatus = document.getElementById("api-status");
const compareSection = document.getElementById("compare");
const newTitle = document.getElementById("new-title");
const newMeta = document.getElementById("new-meta");
const newPoster = document.getElementById("new-poster");
const newCard = document.getElementById("new-card");
const existingTitle = document.getElementById("existing-title");
const existingMeta = document.getElementById("existing-meta");
const existingPoster = document.getElementById("existing-poster");
const existingCard = document.getElementById("existing-card");
const compareSub = document.getElementById("compare-sub");
const rankingList = document.getElementById("ranking");
const clearButton = document.getElementById("clear-list");
const authSignedOut = document.getElementById("auth-signed-out");
const authSignedIn = document.getElementById("auth-signed-in");
const authEmailInput = document.getElementById("auth-email");
const authSignInButton = document.getElementById("auth-sign-in");
const authSignOutButton = document.getElementById("auth-sign-out");
const authUserLabel = document.getElementById("auth-user");
const authStatus = document.getElementById("auth-status");
const debugPanel = document.getElementById("debug-panel");
const debugContent = document.getElementById("debug-content");
const addFeedback = document.getElementById("add-feedback");

const TMDB_PROXY_PATH = "/functions/v1/tmdb-search";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const TMDB_POSTER_SMALL = "https://image.tmdb.org/t/p/w92";
const STORAGE_KEY = "stackrank:movies:v1";
const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZmhha3J4c2xscnFtc2N4eHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MzkzOTYsImV4cCI6MjA4MjExNTM5Nn0.XYeheYWAMNbUC9MUPv1oF7J3-MwxfcBS7-QpxRszrSs";

let ranking = [];
let pending = null;
let searchRange = null;
let selectedSuggestion = null;
let suggestionItems = [];
let activeSuggestionIndex = -1;
let currentSuggestions = [];
let debounceTimer = null;
let currentUser = null;
let statusTimeout = null;
let dragIndex = null;
let dragItem = null;
let dragTargetIndex = null;
let dragPointerY = null;
let dragGhost = null;
let dragOverRaf = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragPointerId = null;
let dragCaptureEl = null;
let migrationStats = null;
const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
let highlightTimeout = null;

const storageEnabled = typeof window !== "undefined" && "localStorage" in window;
const supabaseEnabled =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const supabase = supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const tmdbProxyEnabled = supabaseEnabled;
const tmdbProxyUrl = supabaseEnabled ? `${SUPABASE_URL}${TMDB_PROXY_PATH}` : "";

const formatMeta = (movie) => {
  if (!movie.year) return "Year unknown";
  return `Released ${movie.year}`;
};

const normalizeTitle = (value) => value.trim().toLowerCase();

const isDuplicateMovie = (movie) => {
  const title = normalizeTitle(movie.title);
  return ranking.some((existing) => {
    if (movie.tmdbId && existing.tmdbId && existing.tmdbId === movie.tmdbId) {
      return true;
    }
    const existingTitle = normalizeTitle(existing.title);
    if (existingTitle !== title) return false;
    if (movie.year && existing.year) {
      return existing.year === movie.year;
    }
    return true;
  });
};

const setPoster = (imageEl, movie) => {
  if (movie && movie.posterPath) {
    imageEl.src = `${TMDB_POSTER_BASE}${movie.posterPath}`;
    imageEl.alt = `${movie.title} poster`;
    imageEl.style.visibility = "visible";
  } else {
    imageEl.removeAttribute("src");
    imageEl.alt = "";
    imageEl.style.visibility = "hidden";
  }
};

const getListId = () => {
  if (currentUser && currentUser.id) {
    return `user:${currentUser.id}`;
  }
  return null;
};

const renderRanking = () => {
  rankingList.innerHTML = "";

  if (ranking.length === 0) {
    const empty = document.createElement("li");
    empty.className = "ranking__empty";
    empty.textContent = "No movies yet. Add one to begin.";
    rankingList.appendChild(empty);
    return;
  }

  ranking.forEach((movie, index) => {
    const item = document.createElement("li");
    item.className = "ranking__item";
    item.dataset.index = String(index);
    item.setAttribute("aria-grabbed", "false");
    const handle = document.createElement("span");
    handle.className = "ranking__handle";
    handle.textContent = "≡";
    handle.setAttribute("aria-hidden", "true");
    const removeButton = document.createElement("button");
    removeButton.className = "ranking__delete";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${movie.title}`);
    removeButton.textContent = "×";
    const poster = document.createElement("img");
    poster.className = "ranking__poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
      poster.style.visibility = "visible";
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const text = document.createElement("div");
    text.className = "ranking__text";
    const title = document.createElement("div");
    title.className = "ranking__title";
    title.textContent = `${index + 1}. ${movie.title}`;
    const meta = document.createElement("div");
    meta.className = "ranking__meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";

    text.append(title, meta);
    item.append(handle, poster, text, removeButton);
    rankingList.appendChild(item);
  });
};

const saveRanking = async () => {
  const listId = getListId();
  if (supabaseEnabled && supabase && listId) {
    const payload = {
      list_id: listId,
      movies: ranking,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("rankings")
      .upsert(payload, { onConflict: "list_id" });
    if (!error) return;
  }

  if (!storageEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ranking));
  } catch (error) {
    // Ignore write errors (storage full, blocked, etc.).
  }
};

const loadRanking = async () => {
  const listId = getListId();
  if (supabaseEnabled && supabase && listId) {
    const { data, error } = await supabase
      .from("rankings")
      .select("movies")
      .eq("list_id", listId)
      .maybeSingle();
    if (!error && data && Array.isArray(data.movies)) {
      ranking = data.movies;
      return;
    }
  }

  if (!storageEnabled) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (Array.isArray(stored)) {
      ranking = stored;
    }
  } catch (error) {
    // Ignore corrupt storage and continue with an empty list.
  }
};

const startComparison = () => {
  if (!pending) return;

  if (ranking.length === 0) {
    ranking.push(pending);
    pending = null;
    saveRanking();
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    setAddFeedback(`"${ranking[0].title}" placed as your top pick.`);
    highlightRankingItem(0);
    titleInput.focus();
    return;
  }

  searchRange = { low: 0, high: ranking.length - 1 };
  showComparison();
};

const showComparison = () => {
  if (!pending || !searchRange) return;

  const mid = Math.floor((searchRange.low + searchRange.high) / 2);
  const existing = ranking[mid];

  newTitle.textContent = pending.title;
  newMeta.textContent = formatMeta(pending);
  setPoster(newPoster, pending);
  existingTitle.textContent = existing.title;
  existingMeta.textContent = formatMeta(existing);
  setPoster(existingPoster, existing);

  compareSub.textContent = `Comparison ${pending.comparisons + 1} of ~${Math.ceil(Math.log2(ranking.length + 1))}`;
  compareSection.classList.remove("panel--hidden");

  newCard.onclick = () => handleDecision(true, mid);
  existingCard.onclick = () => handleDecision(false, mid);
  newCard.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDecision(true, mid);
    }
  };
  existingCard.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleDecision(false, mid);
    }
  };
};

const handleDecision = (isNewBetter, midIndex) => {
  pending.comparisons += 1;
  if (isNewBetter) {
    searchRange.high = midIndex - 1;
  } else {
    searchRange.low = midIndex + 1;
  }

  if (searchRange.low > searchRange.high) {
    const insertIndex = searchRange.low;
    ranking.splice(insertIndex, 0, pending);
    const leftNeighbor = ranking[insertIndex - 1];
    const rightNeighbor = ranking[insertIndex + 1];
    pending = null;
    searchRange = null;
    saveRanking();
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    const placedTitle = `"${ranking[insertIndex].title}"`;
    if (leftNeighbor && rightNeighbor) {
      setAddFeedback(
        `${placedTitle} placed at #${insertIndex + 1} between "${leftNeighbor.title}" and "${rightNeighbor.title}".`,
      );
    } else if (leftNeighbor) {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1} below "${leftNeighbor.title}".`);
    } else if (rightNeighbor) {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1} above "${rightNeighbor.title}".`);
    } else {
      setAddFeedback(`${placedTitle} placed at #${insertIndex + 1}.`);
    }
    highlightRankingItem(insertIndex);
    titleInput.focus();
    return;
  }

  showComparison();
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedSuggestion) {
    setStatusMessage("Select a movie from the suggestions to add.");
    return;
  }
  hideSuggestions();
  startRankingFromSelection();
});

clearButton.addEventListener("click", () => {
  if (!window.confirm("Clear the entire ranking list?")) {
    return;
  }
  ranking = [];
  pending = null;
  searchRange = null;
  saveRanking();
  compareSection.classList.add("panel--hidden");
  form.reset();
  renderRanking();
  titleInput.focus();
});

rankingList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".ranking__delete");
  if (!removeButton) return;
  const item = removeButton.closest(".ranking__item");
  if (!item) return;
  const index = Number(item.dataset.index);
  if (Number.isNaN(index)) return;
  const movie = ranking[index];
  if (!movie) return;
  if (!window.confirm(`Remove "${movie.title}" from the list?`)) return;
  ranking.splice(index, 1);
  saveRanking();
  renderRanking();
});

const clearDragShifts = () => {
  rankingList.querySelectorAll(".is-shifting").forEach((el) => {
    el.classList.remove("is-shifting");
    el.style.transform = "";
  });
};

const updateDragLayout = () => {
  if (!dragItem || dragIndex === null || dragPointerY === null) return;
  const items = Array.from(rankingList.querySelectorAll(".ranking__item")).filter(
    (el) => el !== dragItem,
  );
  const rects = items.map((el) => el.getBoundingClientRect());
  let nextIndex = rects.findIndex((rect) => dragPointerY < rect.top + rect.height / 2);
  if (nextIndex === -1) nextIndex = items.length;
  if (nextIndex === dragTargetIndex) return;
  dragTargetIndex = nextIndex;
  clearDragShifts();
  const originIndex = Math.min(dragIndex, items.length);
  items.forEach((el, index) => {
    const height = rects[index].height * 0.5;
    if (nextIndex > originIndex && index >= originIndex && index < nextIndex) {
      el.classList.add("is-shifting");
      el.style.transform = `translateY(${-height}px)`;
    } else if (nextIndex < originIndex && index >= nextIndex && index < originIndex) {
      el.classList.add("is-shifting");
      el.style.transform = `translateY(${height}px)`;
    }
  });
};

const updateDragGhost = (event) => {
  if (!dragGhost) return;
  dragGhost.style.left = `${event.clientX - dragOffsetX}px`;
  dragGhost.style.top = `${event.clientY - dragOffsetY}px`;
};

const onPointerMove = (event) => {
  dragPointerY = event.clientY;
  updateDragGhost(event);
  updateDragLayout();
};

const endDrag = () => {
  if (!dragItem || dragIndex === null) return;
  if (dragCaptureEl && dragCaptureEl.releasePointerCapture && dragPointerId !== null) {
    try {
      dragCaptureEl.releasePointerCapture(dragPointerId);
    } catch (error) {
      // Ignore missing pointer capture.
    }
  }
  const items = Array.from(rankingList.querySelectorAll(".ranking__item")).filter(
    (el) => el !== dragItem,
  );
  const insertIndex = dragTargetIndex ?? dragIndex;
  const currentOrder = items.map((el) => Number(el.dataset.index));
  const updated = currentOrder.map((index) => ranking[index]);
  const moved = ranking[dragIndex];
  updated.splice(insertIndex, 0, moved);
  ranking = updated;
  saveRanking();
  renderRanking();
  dragItem.classList.remove("is-dragging");
  dragItem.setAttribute("aria-grabbed", "false");
  dragItem = null;
  dragIndex = null;
  dragTargetIndex = null;
  dragPointerY = null;
  dragPointerId = null;
  dragCaptureEl = null;
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  if (dragOverRaf) {
    window.cancelAnimationFrame(dragOverRaf);
    dragOverRaf = null;
  }
  clearDragShifts();
  document.body.classList.remove("is-dragging");
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  window.removeEventListener("scroll", updateDragLayout, true);
};

rankingList.addEventListener(
  "pointerdown",
  (event) => {
    if (event.target.closest(".ranking__delete")) return;
    const item = event.target.closest(".ranking__item");
    if (!item) return;
    event.preventDefault();
    if (item.setPointerCapture) {
      item.setPointerCapture(event.pointerId);
    }
    dragPointerId = event.pointerId;
    dragCaptureEl = item;
    dragItem = item;
    dragIndex = Number(item.dataset.index);
    dragTargetIndex = dragIndex;
    dragPointerY = event.clientY;
  const rect = item.getBoundingClientRect();
  dragOffsetX = event.clientX - rect.left;
  dragOffsetY = event.clientY - rect.top;
  dragGhost = item.cloneNode(true);
  dragGhost.classList.add("drag-ghost");
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  dragGhost.style.left = `${rect.left}px`;
  dragGhost.style.top = `${rect.top}px`;
  document.body.appendChild(dragGhost);
  item.classList.add("is-dragging");
  item.setAttribute("aria-grabbed", "true");
  document.body.classList.add("is-dragging");
  updateDragLayout();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("scroll", updateDragLayout, true);
  },
  { passive: false },
);

const updateStatus = () => {
  if (!supabaseEnabled) {
    apiStatus.textContent = "Add Supabase keys to enable autocomplete and sync.";
    return;
  }

  apiStatus.textContent = currentUser
    ? "Search powered by TMDB via Supabase. Syncing enabled."
    : "Search powered by TMDB via Supabase. Sign in to sync across devices.";
};

const setStatusMessage = (message, duration = 2200) => {
  apiStatus.textContent = message;
  if (statusTimeout) {
    window.clearTimeout(statusTimeout);
  }
  statusTimeout = window.setTimeout(() => {
    updateStatus();
  }, duration);
};

const setAddFeedback = (message, duration = null) => {
  addFeedback.textContent = message;
  if (highlightTimeout) {
    window.clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
  if (duration !== null) {
    highlightTimeout = window.setTimeout(() => {
      addFeedback.textContent = "";
    }, duration);
  }
};

const highlightRankingItem = (index) => {
  const items = rankingList.querySelectorAll(".ranking__item");
  const item = items[index];
  if (!item) return;
  item.classList.add("is-highlight");
  item.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    item.classList.remove("is-highlight");
  }, 2000);
};

const updateDebugPanel = (extra = {}) => {
  if (!debugEnabled) return;
  debugPanel.classList.remove("debug--hidden");
  const rankingSummary = ranking.map((movie) => ({
    title: movie.title,
    year: movie.year || null,
    tmdbId: movie.tmdbId || null,
  }));
  const payload = {
    migration: migrationStats,
    rankingCount: ranking.length,
    rankingSummary,
    selectedSuggestion: selectedSuggestion
      ? {
          title: selectedSuggestion.title,
          year: selectedSuggestion.year || null,
          tmdbId: selectedSuggestion.tmdbId || null,
        }
      : null,
    ...extra,
  };
  debugContent.textContent = JSON.stringify(payload, null, 2);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveTmdbMatch = async (movie) => {
  if (!tmdbProxyEnabled) return null;
  const query = movie.title;
  const url = `${tmdbProxyUrl}?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const results = data.results || [];
    if (!results.length) return null;
    const byYear =
      movie.year &&
      results.find((result) => result.year && Number(result.year) === Number(movie.year));
    return byYear || results[0];
  } catch (error) {
    return null;
  }
};

const migrateRanking = async () => {
  const missing = ranking.filter((movie) => !movie.tmdbId);
  migrationStats = { missing: missing.length, updated: 0, skipped: 0 };
  if (!missing.length) return;
  setStatusMessage("Updating existing items…", 2400);
  let updated = false;
  for (const movie of missing) {
    const match = await resolveTmdbMatch(movie);
    if (match && match.tmdbId) {
      movie.tmdbId = match.tmdbId;
      if (!movie.posterPath) movie.posterPath = match.posterPath;
      if (!movie.year && match.year) movie.year = match.year;
      updated = true;
      migrationStats.updated += 1;
    } else {
      migrationStats.skipped += 1;
    }
    await sleep(180);
  }
  if (updated) {
    await saveRanking();
    renderRanking();
  }
  updateDebugPanel();
};

const setAuthUI = () => {
  if (!supabaseEnabled) {
    authSignedOut.classList.add("auth__hidden");
    authSignedIn.classList.add("auth__hidden");
    authStatus.textContent = "Supabase is not configured.";
    return;
  }

  if (currentUser) {
    authSignedOut.classList.add("auth__hidden");
    authSignedIn.classList.remove("auth__hidden");
    authUserLabel.textContent = `Signed in as ${currentUser.email || "user"}`;
    authStatus.textContent = "";
  } else {
    authSignedOut.classList.remove("auth__hidden");
    authSignedIn.classList.add("auth__hidden");
    authStatus.textContent = "";
  }
};

const handleSignIn = async () => {
  if (!supabaseEnabled || !supabase) return;
  const email = authEmailInput.value.trim();
  if (!email) {
    authStatus.textContent = "Add an email address to receive a sign-in link.";
    return;
  }
  authStatus.textContent = "Sending magic link...";
  const redirectBase = window.location.hostname.includes("github.io")
    ? `${window.location.origin}/StackRank-Web/`
    : window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectBase,
    },
  });
  if (error) {
    authStatus.textContent = `Sign-in failed: ${error.message}`;
    return;
  }
  authEmailInput.value = "";
  authStatus.textContent = "Check your email for the sign-in link.";
};

const handleSignOut = async () => {
  if (!supabaseEnabled || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    authStatus.textContent = `Sign-out failed: ${error.message}`;
    return;
  }
  ranking = [];
  pending = null;
  searchRange = null;
  saveRanking();
  renderRanking();
  authStatus.textContent = "Signed out.";
};

const initAuth = async () => {
  if (!supabaseEnabled || !supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session ? data.session.user : null;
  setAuthUI();
  updateStatus();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session ? session.user : null;
    setAuthUI();
    updateStatus();
    loadRanking()
      .then(migrateRanking)
      .then(renderRanking)
      .then(updateDebugPanel);
  });

  authSignInButton.addEventListener("click", handleSignIn);
  authSignOutButton.addEventListener("click", handleSignOut);
};

const hideSuggestions = () => {
  suggestions.style.display = "none";
  suggestions.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
  currentSuggestions = [];
};

const setActiveSuggestion = (index) => {
  if (!suggestionItems.length) return;
  activeSuggestionIndex = index;
  suggestionItems.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add("is-active");
    } else {
      item.classList.remove("is-active");
    }
  });
};

const pickSuggestion = (movie) => {
  if (pending) return;
  selectedSuggestion = movie;
  titleInput.value = movie.title;
  hideSuggestions();
  startRankingFromSelection();
};

const startRankingFromSelection = () => {
  if (!selectedSuggestion) return;
  setAddFeedback("");
  const suggestionMatches = selectedSuggestion && selectedSuggestion.title === titleInput.value.trim();
  if (!suggestionMatches) {
    setStatusMessage("Select a movie from the suggestions to add.");
    return;
  }
  if (isDuplicateMovie(selectedSuggestion)) {
    setStatusMessage(`"${selectedSuggestion.title}" is already in your list. Add something else.`);
    updateDebugPanel({ duplicateBlocked: selectedSuggestion.tmdbId || selectedSuggestion.title });
    return;
  }
  pending = {
    title: selectedSuggestion.title,
    year: selectedSuggestion.year,
    posterPath: selectedSuggestion.posterPath,
    tmdbId: selectedSuggestion.tmdbId,
    comparisons: 0,
  };
  selectedSuggestion = null;
  startComparison();
  updateDebugPanel({ addedMovie: pending?.tmdbId || pending?.title || null });
};

const renderSuggestions = (movies) => {
  suggestions.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
  currentSuggestions = movies;

  if (!movies.length) {
    hideSuggestions();
    return;
  }

  movies.forEach((movie, index) => {
    const item = document.createElement("div");
    item.className = "suggestions__item";
    item.setAttribute("role", "option");
    item.dataset.index = index;

    const poster = document.createElement("img");
    poster.className = "suggestions__poster";
    if (movie.posterPath) {
      poster.src = `${TMDB_POSTER_SMALL}${movie.posterPath}`;
      poster.alt = `${movie.title} poster`;
      poster.style.visibility = "visible";
    } else {
      poster.alt = "";
      poster.style.visibility = "hidden";
    }

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "suggestions__title";
    title.textContent = movie.title;
    const meta = document.createElement("div");
    meta.className = "suggestions__meta";
    meta.textContent = movie.year ? `Released ${movie.year}` : "Year unknown";
    text.append(title, meta);

    item.append(poster, text);
    item.addEventListener("click", () => pickSuggestion(movie));
    suggestions.appendChild(item);
    suggestionItems.push(item);
  });

  suggestions.style.display = "block";
};

const fetchSuggestions = async (query) => {
  if (!tmdbProxyEnabled) return;
  const url = `${tmdbProxyUrl}?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!response.ok) {
      hideSuggestions();
      return;
    }
    const data = await response.json();
    if (titleInput.value.trim() !== query) return;
    const movies = (data.results || []).slice(0, 6);
    renderSuggestions(movies);
  } catch (error) {
    hideSuggestions();
  }
};

titleInput.addEventListener("input", (event) => {
  selectedSuggestion = null;
  const value = event.target.value.trim();

  if (!tmdbProxyEnabled || value.length < 2) {
    hideSuggestions();
    return;
  }

  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    fetchSuggestions(value);
  }, 250);
});

titleInput.addEventListener("keydown", (event) => {
  if (!suggestionItems.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = (activeSuggestionIndex + 1) % suggestionItems.length;
    setActiveSuggestion(nextIndex);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex = (activeSuggestionIndex - 1 + suggestionItems.length) % suggestionItems.length;
    setActiveSuggestion(nextIndex);
  } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    const movie = currentSuggestions[activeSuggestionIndex];
    if (movie) {
      pickSuggestion(movie);
    }
  }
});

document.addEventListener("click", (event) => {
  if (!suggestions.contains(event.target) && event.target !== titleInput) {
    hideSuggestions();
  }
});

suggestions.addEventListener("mousemove", (event) => {
  const item = event.target.closest(".suggestions__item");
  if (!item) return;
  const index = suggestionItems.indexOf(item);
  if (index >= 0) setActiveSuggestion(index);
});

const init = async () => {
  updateStatus();
  setAuthUI();
  await initAuth();
  await loadRanking();
  await migrateRanking();
  renderRanking();
  updateDebugPanel();
};

init();
