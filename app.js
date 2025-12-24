import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const form = document.getElementById("movie-form");
const titleInput = document.getElementById("title");
const yearInput = document.getElementById("year");
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

const TMDB_API_KEY = "YOUR_TMDB_KEY";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
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

const apiEnabled = TMDB_API_KEY && TMDB_API_KEY !== "YOUR_TMDB_KEY";
const storageEnabled = typeof window !== "undefined" && "localStorage" in window;
const supabaseEnabled =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
const supabase = supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const normalizeYear = (value) => {
  if (!value) return null;
  const year = Number(value);
  if (Number.isNaN(year)) return null;
  return year;
};

const formatMeta = (movie) => {
  if (!movie.year) return "Year unknown";
  return `Released ${movie.year}`;
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
    item.append(poster, text);
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
    ranking.splice(searchRange.low, 0, pending);
    pending = null;
    searchRange = null;
    saveRanking();
    compareSection.classList.add("panel--hidden");
    form.reset();
    renderRanking();
    titleInput.focus();
    return;
  }

  showComparison();
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const year = normalizeYear(yearInput.value.trim());

  if (!title) return;

  pending = {
    title,
    year,
    posterPath: selectedSuggestion && selectedSuggestion.title === title ? selectedSuggestion.posterPath : null,
    comparisons: 0,
  };

  selectedSuggestion = null;
  hideSuggestions();
  startComparison();
});

clearButton.addEventListener("click", () => {
  ranking = [];
  pending = null;
  searchRange = null;
  saveRanking();
  compareSection.classList.add("panel--hidden");
  form.reset();
  renderRanking();
  titleInput.focus();
});

const updateStatus = () => {
  if (!apiEnabled) {
    apiStatus.textContent = "Add your TMDB API key in app.js to enable autocomplete.";
    return;
  }

  if (!supabaseEnabled) {
    apiStatus.textContent = "Search powered by TMDB. Add Supabase keys to sync across devices.";
    return;
  }

  apiStatus.textContent = currentUser
    ? "Search powered by TMDB. Syncing with Supabase."
    : "Search powered by TMDB. Sign in to sync across devices.";
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
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
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
    loadRanking().then(renderRanking);
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
  selectedSuggestion = movie;
  titleInput.value = movie.title;
  yearInput.value = movie.year || "";
  hideSuggestions();
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
  if (!apiEnabled) return;
  const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      hideSuggestions();
      return;
    }
    const data = await response.json();
    if (titleInput.value.trim() !== query) return;
    const movies = (data.results || []).slice(0, 6).map((movie) => ({
      title: movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
      posterPath: movie.poster_path,
    }));
    renderSuggestions(movies);
  } catch (error) {
    hideSuggestions();
  }
};

titleInput.addEventListener("input", (event) => {
  selectedSuggestion = null;
  const value = event.target.value.trim();

  if (!apiEnabled || value.length < 2) {
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
  renderRanking();
};

init();
