import {
  ARTWORK_REVIEW_CONCERNS,
  ARTWORK_REVIEW_PAGE_SIZE,
  ARTWORK_REVIEW_STORAGE_KEY,
  buildArtworkReviewExport,
  clearArtworkReview,
  filterArtworkAssets,
  isArtworkFlagged,
  isArtworkReviewStale,
  normalizeArtworkReviewState,
  paginateArtworkAssets,
  preferredArtworkVariant,
  setArtworkReview,
} from "/lib/dogs-artwork-review.js?v=1";

const DATA_URLS = {
  manifest: "/data/dogs/generated-artwork.json?v=12",
  catalog: "/data/dogs/dog-catalog.json?v=4",
  profiles: "/data/dogs/breed-profiles.json?v=1",
};

const BATCH_METADATA_URLS = [
  "/data/dogs/generated-artwork-batch-root.json",
  "/data/dogs/generated-artwork-batch-a.json",
  "/data/dogs/generated-artwork-batch-b.json",
  "/data/dogs/generated-artwork-batch-c.json",
  "/data/dogs/generated-artwork-batch-d.json",
  ...Array.from({ length: 9 }, (_, index) =>
    `/data/dogs/generated-artwork-batch-e${String(index + 1).padStart(2, "0")}.json`),
];

const dom = {
  assetCount: document.querySelector("#asset-count"),
  visibleCount: document.querySelector("#visible-count"),
  flaggedCount: document.querySelector("#flagged-count"),
  storageWarning: document.querySelector("#storage-warning"),
  loadError: document.querySelector("#load-error"),
  search: document.querySelector("#artwork-search"),
  filter: document.querySelector("#artwork-filter"),
  gallery: document.querySelector("#artwork-gallery"),
  empty: document.querySelector("#empty-state"),
  galleryStatus: document.querySelector("#gallery-status"),
  manifestVersion: document.querySelector("#manifest-version"),
  previous: document.querySelector("#previous-page"),
  next: document.querySelector("#next-page"),
  pageStatus: document.querySelector("#page-status"),
  export: document.querySelector("#export-review"),
  dialog: document.querySelector("#artwork-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogCatalogId: document.querySelector("#dialog-catalog-id"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogProfile: document.querySelector("#dialog-profile"),
  dialogProfileTags: document.querySelector("#dialog-profile-tags"),
  generationRecord: document.querySelector("#generation-record"),
  generationLoading: document.querySelector("#generation-loading"),
  generationExtra: document.querySelector("#generation-extra"),
  dialogQa: document.querySelector("#dialog-qa"),
  concernForm: document.querySelector("#concern-form"),
  concernOptions: document.querySelector("#concern-options"),
  concernNote: document.querySelector("#concern-note"),
  clearReview: document.querySelector("#clear-review"),
  saveStatus: document.querySelector("#save-status"),
};

const state = {
  manifestVersion: null,
  assets: [],
  reviews: normalizeArtworkReviewState(null),
  query: "",
  flaggedOnly: false,
  page: 1,
  activeAssetId: null,
  dialogRequest: 0,
  drafts: new Map(),
  opener: null,
  storageAvailable: true,
};

const batchCache = new Map();

function rootUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return `/${value.replace(/^\.\//, "")}`;
}

async function fetchJson(url, { required = true } = {}) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    if (!required) return null;
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function readReviews() {
  try {
    const raw = localStorage.getItem(ARTWORK_REVIEW_STORAGE_KEY);
    state.reviews = normalizeArtworkReviewState(raw ? JSON.parse(raw) : null);
  } catch {
    state.storageAvailable = false;
    state.reviews = normalizeArtworkReviewState(null);
    showStorageWarning("Local artwork flags could not be read. New changes will last only until this page closes; export them before leaving.");
  }
}

function persistReviewChange(assetId) {
  if (!state.storageAvailable) return false;
  try {
    const stored = localStorage.getItem(ARTWORK_REVIEW_STORAGE_KEY);
    const merged = normalizeArtworkReviewState(stored ? JSON.parse(stored) : null);
    const changed = state.reviews.reviews[assetId];
    if (changed) merged.reviews[assetId] = changed;
    else delete merged.reviews[assetId];
    localStorage.setItem(ARTWORK_REVIEW_STORAGE_KEY, JSON.stringify(merged));
    state.reviews = merged;
    return true;
  } catch {
    state.storageAvailable = false;
    showStorageWarning("Local artwork flags could not be saved. Your current changes remain in this tab; export them before leaving.");
    return false;
  }
}

function showStorageWarning(message) {
  dom.storageWarning.textContent = message;
  dom.storageWarning.hidden = false;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function addDefinition(list, term, content) {
  const row = make("div");
  row.append(make("dt", null, term));
  const description = make("dd");
  if (content instanceof Node) description.append(content);
  else description.textContent = content || "Unavailable";
  row.append(description);
  list.append(row);
}

function formatGeneratedAt(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} · ${value}`;
}

function concernLabel(id) {
  return ARTWORK_REVIEW_CONCERNS.find((concern) => concern.id === id)?.label || id;
}

function hydrateAssets(manifest, catalog, profiles) {
  const entities = new Map((catalog.entities || []).map((entity) => [entity.id, entity]));
  const profileMap = profiles.profiles || {};
  return (manifest.assets || [])
    .filter((asset) => asset.uiDisplayAllowed === true && preferredArtworkVariant(asset, "card"))
    .map((asset) => {
      const entity = entities.get(asset.catalogId) || {};
      return {
        ...asset,
        name: asset.name || entity.displayName || asset.catalogId,
        aliases: Array.isArray(entity.aliases) ? entity.aliases : [],
        entity,
        profile: profileMap[asset.catalogId] || null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.catalogId.localeCompare(right.catalogId));
}

function flaggedCount() {
  return state.assets.filter((asset) => isArtworkFlagged(state.reviews.reviews[asset.assetId])).length;
}

function createCard(asset) {
  const review = state.reviews.reviews[asset.assetId];
  const flagged = isArtworkFlagged(review);
  const stale = isArtworkReviewStale(review, asset);
  const article = make("article", `artwork-card${flagged ? " is-flagged" : ""}`);

  const open = make("button", "artwork-card__open");
  open.type = "button";
  open.dataset.assetId = asset.assetId;
  open.setAttribute("aria-label", `Open ${asset.name} artwork details`);
  const imageFrame = make("div", "artwork-card__image");
  const image = document.createElement("img");
  image.src = rootUrl(preferredArtworkVariant(asset, "card")?.url);
  image.alt = `Generated portrait of ${asset.name}`;
  image.loading = "lazy";
  image.decoding = "async";
  imageFrame.append(image);
  if (flagged) imageFrame.append(make("span", "artwork-card__badge", stale ? "Stale flag" : `${review.concerns.length || 1} flagged`));
  const copy = make("span", "artwork-card__copy");
  copy.append(make("strong", null, asset.name));
  copy.append(make("span", null, asset.catalogId));
  copy.append(make("span", null, asset.promptTemplateVersion || "Prompt template unavailable"));
  open.append(imageFrame, copy);

  const reviewButton = make("button", "artwork-card__review", flagged ? "Review flag" : "Flag a concern");
  reviewButton.type = "button";
  reviewButton.dataset.reviewAssetId = asset.assetId;
  article.append(open, reviewButton);
  return article;
}

function render() {
  const filtered = filterArtworkAssets(state.assets, {
    query: state.query,
    flaggedOnly: state.flaggedOnly,
    reviews: state.reviews.reviews,
  });
  const page = paginateArtworkAssets(filtered, state.page, ARTWORK_REVIEW_PAGE_SIZE);
  state.page = page.page;
  dom.gallery.replaceChildren(...page.items.map(createCard));
  dom.gallery.setAttribute("aria-busy", "false");
  dom.empty.hidden = page.totalItems !== 0;
  dom.gallery.hidden = page.totalItems === 0;
  dom.assetCount.textContent = String(state.assets.length);
  dom.visibleCount.textContent = String(page.totalItems);
  dom.flaggedCount.textContent = String(flaggedCount());
  dom.galleryStatus.textContent = page.totalItems
    ? `Showing ${page.start}–${page.end} of ${page.totalItems} portraits`
    : "No matching portraits";
  dom.pageStatus.textContent = `Page ${page.page} of ${page.totalPages}`;
  dom.previous.disabled = page.page <= 1;
  dom.next.disabled = page.page >= page.totalPages;
  dom.export.disabled = flaggedCount() === 0;
}

function renderConcernOptions(review) {
  dom.concernOptions.replaceChildren(...ARTWORK_REVIEW_CONCERNS.map(({ id, label }) => {
    const option = make("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "concern";
    checkbox.value = id;
    checkbox.checked = review?.concerns?.includes(id) || false;
    option.append(checkbox, make("span", null, label));
    return option;
  }));
}

function renderProfile(asset) {
  const profile = asset.profile;
  dom.dialogProfile.textContent = profile?.summary || "No field-guide summary is available for this catalog entry.";
  const tags = [];
  if (profile?.typeLabel) tags.push(profile.typeLabel);
  if (profile?.sizeBand && profile.sizeBand !== "unknown") tags.push(`${profile.sizeBand} size`);
  if (Array.isArray(profile?.originRegions)) tags.push(...profile.originRegions);
  dom.dialogProfileTags.replaceChildren(...tags.map((tag) => make("span", null, tag)));
}

function renderGenerationRecord(asset, modelText = "Checking preserved batch metadata…") {
  dom.generationRecord.replaceChildren();
  addDefinition(dom.generationRecord, "Asset ID", asset.assetId);
  addDefinition(dom.generationRecord, "Master SHA-256", asset.masterSha256 || "Not recorded");
  addDefinition(dom.generationRecord, "Generator", asset.generator || "Not recorded");
  addDefinition(dom.generationRecord, "Generated", formatGeneratedAt(asset.generatedAt));
  addDefinition(dom.generationRecord, "Prompt template", asset.promptTemplateVersion || "Not recorded");
  addDefinition(dom.generationRecord, "Model", modelText);
  const sourcePage = asset.reference?.sourcePage;
  if (sourcePage) {
    const link = make("a", null, "Open morphology reference file page");
    link.href = sourcePage;
    link.target = "_blank";
    link.rel = "noreferrer";
    addDefinition(dom.generationRecord, "Reference", link);
  } else addDefinition(dom.generationRecord, "Reference", "File-page link unavailable");
}

function renderQa(asset, batchImage = null) {
  const qa = batchImage?.qa || asset.review || {};
  const rows = [
    ["Status", qa.status || qa.verdict],
    ["Reviewed", qa.reviewedAt],
    ["Breed identity", qa.breedIdentity],
    ["Anatomy", qa.anatomy],
    ["Framing", qa.framing || qa.crop],
    ["Aesthetics", qa.aesthetics],
  ].filter(([, value]) => value);
  dom.dialogQa.replaceChildren();
  if (!rows.length) addDefinition(dom.dialogQa, "QA", "No detailed QA record is available in the current manifest.");
  else rows.forEach(([label, value]) => addDefinition(dom.dialogQa, label, value));
}

function batchImages(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.images) ? payload.images : [];
}

function loadBatchMetadata(manifestVersion) {
  const cacheKey = manifestVersion || "unknown-manifest";
  if (batchCache.has(cacheKey)) return batchCache.get(cacheKey);
  const promise = Promise.all(BATCH_METADATA_URLS.map((url) => fetchJson(url, { required: false }).catch(() => null)))
    .then((payloads) => {
      const byCatalog = new Map();
      for (const payload of payloads) {
        for (const image of batchImages(payload)) {
          if (!image?.catalogId) continue;
          const items = byCatalog.get(image.catalogId) || [];
          items.push(image);
          byCatalog.set(image.catalogId, items);
        }
      }
      return byCatalog;
    });
  batchCache.set(cacheKey, promise);
  return promise;
}

function batchForAsset(index, asset) {
  const candidates = index.get(asset.catalogId) || [];
  return candidates.find((candidate) => candidate.generatedAt === asset.generatedAt)
    || candidates.find((candidate) => candidate.masterSha256 === asset.masterSha256)
    || candidates.at(-1)
    || null;
}

function metadataBlock(title, text) {
  const block = make("div", "metadata-block");
  block.append(make("h4", null, title), make("p", null, text));
  return block;
}

function renderBatchExtra(batchImage) {
  dom.generationExtra.replaceChildren();
  const scene = batchImage?.scene;
  const sceneText = typeof scene === "string" ? scene : scene?.description || scene?.setting || "";
  const rationale = typeof scene === "object" ? scene?.rationale : "";
  if (sceneText) dom.generationExtra.append(metadataBlock("Scene", sceneText));
  else dom.generationExtra.append(metadataBlock("Scene", "Scene metadata is unavailable in the preserved batch record."));
  if (rationale) dom.generationExtra.append(metadataBlock("Scene rationale", rationale));

  const sources = Array.isArray(scene?.sources) ? scene.sources.filter((source) => source?.url) : [];
  if (sources.length) {
    const block = make("div", "metadata-block");
    block.append(make("h4", null, "Scene sources"));
    const list = make("ul", "source-list");
    for (const source of sources) {
      const item = make("li");
      const link = make("a", null, source.evidence || source.url);
      link.href = rootUrl(source.url);
      link.target = "_blank";
      link.rel = "noreferrer";
      item.append(link);
      list.append(item);
    }
    block.append(list);
    dom.generationExtra.append(block);
  }

  const promptBlock = make("div", "metadata-block");
  promptBlock.append(make("h4", null, "Exact prompt"));
  if (batchImage?.prompt) {
    const details = make("details");
    details.append(make("summary", null, "Show exact preserved prompt"));
    const prompt = make("pre");
    prompt.textContent = batchImage.prompt;
    details.append(prompt);
    promptBlock.append(details);
  } else {
    promptBlock.append(make("p", null, "Exact prompt text is unavailable in the preserved batch record for this portrait."));
  }
  dom.generationExtra.append(promptBlock);
}

function captureActiveDraft() {
  if (!state.activeAssetId || !dom.dialog.open) return;
  const concerns = [...dom.concernOptions.querySelectorAll("input:checked")]
    .map((input) => input.value)
    .sort();
  const note = dom.concernNote.value;
  const saved = state.reviews.reviews[state.activeAssetId];
  const savedConcerns = [...(saved?.concerns || [])].sort();
  const matchesSaved = concerns.length === savedConcerns.length
    && concerns.every((concern, index) => concern === savedConcerns[index])
    && note.trim() === (saved?.note || "");
  if (matchesSaved) state.drafts.delete(state.activeAssetId);
  else state.drafts.set(state.activeAssetId, { concerns, note });
}

async function openArtwork(assetId, { focusReview = false, opener = null } = {}) {
  const asset = state.assets.find((candidate) => candidate.assetId === assetId);
  if (!asset) return;
  captureActiveDraft();
  const requestId = ++state.dialogRequest;
  state.activeAssetId = assetId;
  if (opener) state.opener = opener;
  dom.dialogTitle.textContent = asset.name;
  dom.dialogCatalogId.textContent = asset.catalogId;
  const detailVariant = preferredArtworkVariant(asset, "detail");
  dom.dialogImage.src = rootUrl(detailVariant?.url);
  dom.dialogImage.alt = `Generated portrait of ${asset.name}`;
  renderProfile(asset);
  renderGenerationRecord(asset);
  renderQa(asset);
  dom.generationExtra.replaceChildren();
  dom.generationLoading.hidden = false;
  dom.generationLoading.textContent = "Loading available batch metadata…";
  const review = state.reviews.reviews[assetId];
  const draft = state.drafts.get(assetId);
  renderConcernOptions(draft || review);
  dom.concernNote.value = draft?.note ?? review?.note ?? "";
  dom.clearReview.disabled = !isArtworkFlagged(review);
  dom.saveStatus.textContent = isArtworkReviewStale(review, asset)
    ? "This flag belongs to an older generated master. Review and save again to refresh it."
    : "";
  if (!dom.dialog.open) dom.dialog.showModal();
  (focusReview ? dom.concernOptions.querySelector("input") : dom.dialogClose)?.focus();

  try {
    const index = await loadBatchMetadata(state.manifestVersion);
    if (state.activeAssetId !== assetId || state.dialogRequest !== requestId) return;
    const batchImage = batchForAsset(index, asset);
    renderGenerationRecord(asset, batchImage?.model || "Not recorded in preserved metadata");
    renderBatchExtra(batchImage);
    renderQa(asset, batchImage);
    dom.generationLoading.hidden = true;
  } catch {
    if (state.activeAssetId !== assetId || state.dialogRequest !== requestId) return;
    renderGenerationRecord(asset, "Unavailable because batch metadata could not be loaded");
    renderBatchExtra(null);
    dom.generationLoading.hidden = false;
    dom.generationLoading.textContent = "Preserved batch metadata could not be loaded.";
  }
}

function closeDialog() {
  captureActiveDraft();
  const opener = state.opener;
  state.dialogRequest += 1;
  state.activeAssetId = null;
  if (dom.dialog.open) dom.dialog.close();
  dom.dialogImage.removeAttribute("src");
  requestAnimationFrame(() => {
    const selector = opener?.kind === "review" ? "[data-review-asset-id]" : "[data-asset-id]";
    const target = [...document.querySelectorAll(selector)].find((element) =>
      element.dataset.reviewAssetId === opener?.assetId || element.dataset.assetId === opener?.assetId);
    (target || dom.search || dom.filter)?.focus();
  });
}

function activeAsset() {
  return state.assets.find((asset) => asset.assetId === state.activeAssetId) || null;
}

function saveActiveReview(event) {
  event.preventDefault();
  const asset = activeAsset();
  if (!asset) return;
  const concerns = [...dom.concernOptions.querySelectorAll("input:checked")].map((input) => input.value);
  state.reviews = setArtworkReview(state.reviews, asset.assetId, {
    concerns,
    note: dom.concernNote.value,
    masterSha256: asset.masterSha256,
    generatedAt: asset.generatedAt,
  });
  state.drafts.delete(asset.assetId);
  const persisted = persistReviewChange(asset.assetId);
  const review = state.reviews.reviews[asset.assetId];
  dom.clearReview.disabled = !isArtworkFlagged(review);
  dom.saveStatus.textContent = persisted ? "Saved on this device." : "Saved in this tab; export before leaving.";
  render();
}

function clearActiveReview() {
  const asset = activeAsset();
  if (!asset) return;
  state.reviews = clearArtworkReview(state.reviews, asset.assetId);
  state.drafts.delete(asset.assetId);
  const persisted = persistReviewChange(asset.assetId);
  renderConcernOptions(null);
  dom.concernNote.value = "";
  dom.clearReview.disabled = true;
  dom.saveStatus.textContent = persisted ? "Flag cleared." : "Cleared in this tab; local storage remains unavailable.";
  render();
}

function exportReviews() {
  const payload = buildArtworkReviewExport({
    state: state.reviews,
    assets: state.assets,
    manifestVersion: state.manifestVersion,
  });
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `stackrank-dogs-artwork-review-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

dom.gallery.addEventListener("click", (event) => {
  const open = event.target.closest("[data-asset-id]");
  if (open) openArtwork(open.dataset.assetId, { opener: { assetId: open.dataset.assetId, kind: "open" } });
  const review = event.target.closest("[data-review-asset-id]");
  if (review) openArtwork(review.dataset.reviewAssetId, {
    focusReview: true,
    opener: { assetId: review.dataset.reviewAssetId, kind: "review" },
  });
});
dom.search.addEventListener("input", () => {
  state.query = dom.search.value;
  state.page = 1;
  render();
});
dom.filter.addEventListener("change", () => {
  state.flaggedOnly = dom.filter.value === "flagged";
  state.page = 1;
  render();
});
dom.previous.addEventListener("click", () => {
  state.page -= 1;
  render();
  dom.gallery.scrollIntoView({ behavior: "smooth", block: "start" });
});
dom.next.addEventListener("click", () => {
  state.page += 1;
  render();
  dom.gallery.scrollIntoView({ behavior: "smooth", block: "start" });
});
dom.dialogClose.addEventListener("click", closeDialog);
dom.dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDialog();
});
dom.dialog.addEventListener("click", (event) => {
  if (event.target === dom.dialog) closeDialog();
});
dom.concernForm.addEventListener("submit", saveActiveReview);
dom.clearReview.addEventListener("click", clearActiveReview);
dom.export.addEventListener("click", exportReviews);
window.addEventListener("storage", (event) => {
  if (event.key !== ARTWORK_REVIEW_STORAGE_KEY) return;
  try {
    state.reviews = normalizeArtworkReviewState(event.newValue ? JSON.parse(event.newValue) : null);
    render();
  } catch {
    showStorageWarning("Artwork flags changed in another tab, but the updated local data could not be read. Export this tab before leaving.");
  }
});

async function init() {
  readReviews();
  try {
    const [manifest, catalog, profiles] = await Promise.all([
      fetchJson(DATA_URLS.manifest),
      fetchJson(DATA_URLS.catalog),
      fetchJson(DATA_URLS.profiles),
    ]);
    state.manifestVersion = manifest.manifestVersion || null;
    state.assets = hydrateAssets(manifest, catalog, profiles);
    dom.manifestVersion.textContent = state.manifestVersion ? `Manifest ${state.manifestVersion}` : "Manifest version unavailable";
    render();
  } catch (error) {
    dom.gallery.setAttribute("aria-busy", "false");
    dom.gallery.hidden = true;
    dom.loadError.textContent = `Artwork data could not be loaded. ${error.message}`;
    dom.loadError.hidden = false;
    dom.galleryStatus.textContent = "Artwork unavailable";
  }
}

init();
