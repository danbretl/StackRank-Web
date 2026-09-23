import { filterDogGallery, dogGalleryPage } from "./lib/dogs-explore.js?v=1";

export function createDogsExplorer({ entries, createMedia, openDetail, rankDog }) {
  const $ = (selector) => document.querySelector(selector);
  const view = $("#dogs-view-rank");
  const gallery = $("#dogs-gallery");
  const heading = $("#dogs-gallery-heading");
  const back = $("#dogs-gallery-back");
  const search = $("#dogs-gallery-search");
  const family = $("#dogs-gallery-family");
  const status = $("#dogs-gallery-status");
  const clear = $("#dogs-gallery-clear");
  const count = $("#dogs-gallery-count");
  const grid = $("#dogs-gallery-grid");
  const empty = $("#dogs-gallery-empty");
  const pageLabel = $("#dogs-gallery-page");
  const prev = $("#dogs-gallery-prev");
  const next = $("#dogs-gallery-next");
  const rail = $("#dogs-browse-rail");
  const shuffle = $("#dogs-refresh-browse");
  const surprise = $("#dogs-surprise");
  const detail = $("#dogs-detail");
  const detailNavigation = $("#dogs-detail-navigation");
  const detailPrev = $("#dogs-detail-prev");
  const detailNext = $("#dogs-detail-next");
  const detailPosition = $("#dogs-detail-position");

  let page = 0;
  let filtered = [];
  let railIds = [];
  let openTrigger = null;
  let previousScroll = 0;
  let pendingGalleryDetailId = "";
  let activeGalleryDetailId = "";

  const allEntries = () => entries() || [];
  const unhandled = () => allEntries().filter((entry) => !entry.location);

  const randomSet = (items, size) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled.slice(0, size);
  };

  const makePortraitCard = (entry, { browse = false } = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "explore-dog";
    button.dataset.dogId = entry.id;
    button.setAttribute("aria-label", `${browse ? "About" : "Rank"} ${entry.name}`);
    const portrait = createMedia(entry.id);
    const name = document.createElement("strong");
    name.textContent = entry.name;
    const context = document.createElement("span");
    context.className = "explore-dog__meta";
    context.textContent = [entry.origin, entry.family].filter(Boolean).join(" · ");
    button.append(portrait, name, context);
    if (entry.location) {
      const state = document.createElement("span");
      state.className = "explore-dog__state";
      state.textContent = {
        ranking: "Ranked",
        curious: "Curious about",
        not_for_me: "Not for me",
      }[entry.location] || "";
      if (state.textContent) button.append(state);
    }
    button.addEventListener("click", () => {
      if (browse) {
        pendingGalleryDetailId = entry.id;
        openDetail(entry.id);
      } else rankDog(entry.id);
    });
    return button;
  };

  const renderRail = ({ reshuffle = false } = {}) => {
    const available = unhandled();
    rail.hidden = available.length === 0;
    shuffle.disabled = available.length <= 4;
    rail.replaceChildren();
    if (!available.length) {
      railIds = [];
      return;
    }
    const current = new Set(available.map((entry) => entry.id));
    if (reshuffle || railIds.some((id) => !current.has(id)) || !railIds.length) {
      let chosen = randomSet(available, 4).map((entry) => entry.id);
      if (reshuffle && available.length > 4 && chosen.every((id) => railIds.includes(id))) {
        const replacement = available.find((entry) => !railIds.includes(entry.id));
        if (replacement) chosen[0] = replacement.id;
      }
      railIds = chosen;
    }
    const byId = new Map(available.map((entry) => [entry.id, entry]));
    railIds.forEach((id) => {
      const entry = byId.get(id);
      if (entry) rail.append(makePortraitCard(entry));
    });
  };

  const renderFamilies = () => {
    const selected = family.value;
    const families = [...new Set(allEntries().map((entry) => entry.family).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en"));
    family.replaceChildren(new Option("Every family", ""));
    families.forEach((label) => family.add(new Option(label, label)));
    family.value = families.includes(selected) ? selected : "";
  };

  const renderGallery = () => {
    filtered = filterDogGallery(allEntries(), {
      query: search.value,
      family: family.value,
      status: status.value,
    });
    const shown = dogGalleryPage(filtered, page, 24);
    page = shown.page;
    grid.replaceChildren();
    shown.items.forEach((entry) => grid.append(makePortraitCard(entry, { browse: true })));
    count.textContent = shown.total
      ? `${shown.start}–${shown.end} of ${shown.total} ${shown.total === 1 ? "dog" : "dogs"}`
      : "0 dogs";
    empty.hidden = shown.total !== 0;
    clear.hidden = !search.value && !family.value && !status.value;
    pageLabel.textContent = `Page ${shown.page + 1} of ${shown.pages}`;
    prev.disabled = shown.page === 0;
    next.disabled = shown.page >= shown.pages - 1;
  };

  const enterGallery = (trigger) => {
    if (view.classList.contains("is-browsing")) return;
    openTrigger = trigger;
    previousScroll = window.scrollY;
    renderFamilies();
    renderGallery();
    gallery.hidden = false;
    view.classList.add("is-browsing");
    gallery.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  };

  const leaveGallery = () => {
    gallery.hidden = true;
    view.classList.remove("is-browsing");
    if (openTrigger?.isConnected) openTrigger.focus({ preventScroll: true });
    window.scrollTo({ top: previousScroll, behavior: "auto" });
  };

  const changePage = (direction) => {
    const target = page + direction;
    if (target < 0 || target >= dogGalleryPage(filtered, page, 24).pages) return;
    page = target;
    renderGallery();
    gallery.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  };

  const updateDetailNavigation = () => {
    const index = filtered.findIndex((entry) => entry.id === activeGalleryDetailId);
    detailNavigation.hidden = index < 0;
    if (index < 0) return;
    detailPrev.disabled = index === 0;
    detailNext.disabled = index === filtered.length - 1;
    detailPosition.textContent = `${index + 1} of ${filtered.length}`;
  };

  const moveDetail = (direction) => {
    const index = filtered.findIndex((entry) => entry.id === activeGalleryDetailId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= filtered.length) return;
    const entry = filtered[target];
    page = Math.floor(target / 24);
    renderGallery();
    pendingGalleryDetailId = entry.id;
    openDetail(entry.id);
    detail.scrollTop = 0;
  };

  document.querySelectorAll("[data-open-dog-gallery]").forEach((trigger) => {
    trigger.addEventListener("click", () => enterGallery(trigger));
  });
  back.addEventListener("click", leaveGallery);
  search.addEventListener("input", () => { page = 0; renderGallery(); });
  family.addEventListener("change", () => { page = 0; renderGallery(); });
  status.addEventListener("change", () => { page = 0; renderGallery(); });
  clear.addEventListener("click", () => {
    search.value = "";
    family.value = "";
    status.value = "";
    page = 0;
    renderGallery();
    search.focus();
  });
  prev.addEventListener("click", () => changePage(-1));
  next.addEventListener("click", () => changePage(1));
  shuffle.addEventListener("click", () => renderRail({ reshuffle: true }));
  surprise.addEventListener("click", () => {
    const candidates = unhandled();
    if (candidates.length) rankDog(candidates[Math.floor(Math.random() * candidates.length)].id);
  });

  detail.addEventListener("breed-detail-open", (event) => {
    const id = event.detail?.catalogId;
    activeGalleryDetailId = pendingGalleryDetailId === id && view.classList.contains("is-browsing") ? id : "";
    pendingGalleryDetailId = "";
    detail.classList.toggle("is-exploring", Boolean(activeGalleryDetailId));
    updateDetailNavigation();
  });
  detail.addEventListener("close", () => {
    const id = activeGalleryDetailId;
    activeGalleryDetailId = "";
    detailNavigation.hidden = true;
    detail.classList.remove("is-exploring");
    if (!id || !view.classList.contains("is-browsing") || view.hidden ||
      document.body.classList.contains("is-comparing") || document.body.classList.contains("is-reviewing")) return;
    const card = [...grid.querySelectorAll("[data-dog-id]")].find((item) => item.dataset.dogId === id);
    (card || heading).focus({ preventScroll: true });
    card?.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
  detailPrev.addEventListener("click", () => moveDetail(-1));
  detailNext.addEventListener("click", () => moveDetail(1));

  document.addEventListener("keydown", (event) => {
    if (!view.classList.contains("is-browsing") || view.hidden ||
      document.body.classList.contains("is-comparing") || document.body.classList.contains("is-reviewing") ||
      event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    if (document.querySelector("dialog[open]:not(#dogs-detail)")) return;
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (detail.open) {
      if (!activeGalleryDetailId) return;
      event.preventDefault();
      moveDetail(direction);
    } else {
      event.preventDefault();
      changePage(direction);
    }
  });

  return {
    refresh() {
      const hasEntries = allEntries().length > 0;
      document.querySelectorAll("[data-open-dog-gallery]").forEach((trigger) => { trigger.disabled = !hasEntries; });
      surprise.disabled = unhandled().length === 0;
      renderRail();
      if (view.classList.contains("is-browsing")) {
        renderFamilies();
        renderGallery();
      }
    },
  };
}
