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
import { dogProfileSourceLinks } from "/lib/dogs.js?v=8";

const DATA_URLS = {
  manifest: "/data/dogs/generated-artwork.json?v=93",
  catalog: "/data/dogs/dog-catalog.json?v=5",
  profiles: "/data/dogs/breed-profiles.json?v=90",
};

// Filled from actual finite L batch files by prepare-dog-portrait-l.mjs.
const N_BATCH_METADATA_URLS = [
  "/data/dogs/generated-artwork-batch-n01.json",
  "/data/dogs/generated-artwork-batch-n02.json",
  "/data/dogs/generated-artwork-batch-n04.json",
  "/data/dogs/generated-artwork-batch-n05.json",
  "/data/dogs/generated-artwork-batch-n07.json",
  "/data/dogs/generated-artwork-batch-n08.json",
  "/data/dogs/generated-artwork-batch-n09.json",
  "/data/dogs/generated-artwork-batch-n10.json",
  "/data/dogs/generated-artwork-batch-n14.json",
  "/data/dogs/generated-artwork-batch-n15.json",
  "/data/dogs/generated-artwork-batch-n16.json",
  "/data/dogs/generated-artwork-batch-n17.json",
  "/data/dogs/generated-artwork-batch-n18.json",
  "/data/dogs/generated-artwork-batch-n19.json",
  "/data/dogs/generated-artwork-batch-n20.json",
  "/data/dogs/generated-artwork-batch-n22.json",
  "/data/dogs/generated-artwork-batch-n23.json",
  "/data/dogs/generated-artwork-batch-n24.json",
  "/data/dogs/generated-artwork-batch-n25.json",
  "/data/dogs/generated-artwork-batch-n26.json",
  "/data/dogs/generated-artwork-batch-n27.json",
  "/data/dogs/generated-artwork-batch-n28.json",
  "/data/dogs/generated-artwork-batch-n29.json",
  "/data/dogs/generated-artwork-batch-n30.json",
  "/data/dogs/generated-artwork-batch-n31.json",
  "/data/dogs/generated-artwork-batch-n32.json",
  "/data/dogs/generated-artwork-batch-n33.json",
  "/data/dogs/generated-artwork-batch-n34.json",
  "/data/dogs/generated-artwork-batch-n35.json",
  "/data/dogs/generated-artwork-batch-n36.json",
  "/data/dogs/generated-artwork-batch-n38.json",
  "/data/dogs/generated-artwork-batch-n39.json",
  "/data/dogs/generated-artwork-batch-n41.json",
  "/data/dogs/generated-artwork-batch-n42.json",
  "/data/dogs/generated-artwork-batch-n43.json",
  "/data/dogs/generated-artwork-batch-n44.json",
  "/data/dogs/generated-artwork-batch-n45.json",
  "/data/dogs/generated-artwork-batch-n46.json",
  "/data/dogs/generated-artwork-batch-n47.json",
  "/data/dogs/generated-artwork-batch-n48.json",
  "/data/dogs/generated-artwork-batch-n49.json",
  "/data/dogs/generated-artwork-batch-n50.json",
  "/data/dogs/generated-artwork-batch-n51.json",
  "/data/dogs/generated-artwork-batch-n52.json",
  "/data/dogs/generated-artwork-batch-n53.json",
  "/data/dogs/generated-artwork-batch-n54.json",
  "/data/dogs/generated-artwork-batch-n55.json",
  "/data/dogs/generated-artwork-batch-n56.json",
  "/data/dogs/generated-artwork-batch-n57.json",
  "/data/dogs/generated-artwork-batch-n58.json",
  "/data/dogs/generated-artwork-batch-n59.json",
  "/data/dogs/generated-artwork-batch-n60.json",
  "/data/dogs/generated-artwork-batch-n61.json",
  "/data/dogs/generated-artwork-batch-n62.json",
  "/data/dogs/generated-artwork-batch-n63.json",
  "/data/dogs/generated-artwork-batch-n64.json",
  "/data/dogs/generated-artwork-batch-n65.json",
  "/data/dogs/generated-artwork-batch-n67.json",
  "/data/dogs/generated-artwork-batch-n68.json",
  "/data/dogs/generated-artwork-batch-n69.json",
  "/data/dogs/generated-artwork-batch-n70.json",
  "/data/dogs/generated-artwork-batch-n71.json",
  "/data/dogs/generated-artwork-batch-n72.json",
  "/data/dogs/generated-artwork-batch-n73.json",
  "/data/dogs/generated-artwork-batch-n74.json",
  "/data/dogs/generated-artwork-batch-n75.json",
  "/data/dogs/generated-artwork-batch-n76.json",
  "/data/dogs/generated-artwork-batch-n77.json",
  "/data/dogs/generated-artwork-batch-n78.json",
  "/data/dogs/generated-artwork-batch-n79.json",
  "/data/dogs/generated-artwork-batch-n80.json",
  "/data/dogs/generated-artwork-batch-n81.json",
  "/data/dogs/generated-artwork-batch-n82.json",
  "/data/dogs/generated-artwork-batch-n83.json",
  "/data/dogs/generated-artwork-batch-n84.json",
  "/data/dogs/generated-artwork-batch-n85.json",
  "/data/dogs/generated-artwork-batch-n86.json"
];
const M_BATCH_METADATA_URLS = [
  "/data/dogs/generated-artwork-batch-m01.json",
  "/data/dogs/generated-artwork-batch-m02.json",
  "/data/dogs/generated-artwork-batch-m03.json",
  "/data/dogs/generated-artwork-batch-m04.json",
  "/data/dogs/generated-artwork-batch-m05.json",
  "/data/dogs/generated-artwork-batch-m06.json",
  "/data/dogs/generated-artwork-batch-m07.json",
  "/data/dogs/generated-artwork-batch-m08.json",
  "/data/dogs/generated-artwork-batch-m09.json",
  "/data/dogs/generated-artwork-batch-m10.json",
  "/data/dogs/generated-artwork-batch-m100.json",
  "/data/dogs/generated-artwork-batch-m101.json",
  "/data/dogs/generated-artwork-batch-m11.json",
  "/data/dogs/generated-artwork-batch-m12.json",
  "/data/dogs/generated-artwork-batch-m13.json",
  "/data/dogs/generated-artwork-batch-m14.json",
  "/data/dogs/generated-artwork-batch-m15.json",
  "/data/dogs/generated-artwork-batch-m16.json",
  "/data/dogs/generated-artwork-batch-m17.json",
  "/data/dogs/generated-artwork-batch-m18.json",
  "/data/dogs/generated-artwork-batch-m19.json",
  "/data/dogs/generated-artwork-batch-m20.json",
  "/data/dogs/generated-artwork-batch-m21.json",
  "/data/dogs/generated-artwork-batch-m22.json",
  "/data/dogs/generated-artwork-batch-m23.json",
  "/data/dogs/generated-artwork-batch-m24.json",
  "/data/dogs/generated-artwork-batch-m25.json",
  "/data/dogs/generated-artwork-batch-m26.json",
  "/data/dogs/generated-artwork-batch-m27.json",
  "/data/dogs/generated-artwork-batch-m28.json",
  "/data/dogs/generated-artwork-batch-m29.json",
  "/data/dogs/generated-artwork-batch-m30.json",
  "/data/dogs/generated-artwork-batch-m31.json",
  "/data/dogs/generated-artwork-batch-m32.json",
  "/data/dogs/generated-artwork-batch-m33.json",
  "/data/dogs/generated-artwork-batch-m34.json",
  "/data/dogs/generated-artwork-batch-m35.json",
  "/data/dogs/generated-artwork-batch-m36.json",
  "/data/dogs/generated-artwork-batch-m37.json",
  "/data/dogs/generated-artwork-batch-m38.json",
  "/data/dogs/generated-artwork-batch-m39.json",
  "/data/dogs/generated-artwork-batch-m40.json",
  "/data/dogs/generated-artwork-batch-m41.json",
  "/data/dogs/generated-artwork-batch-m42.json",
  "/data/dogs/generated-artwork-batch-m43.json",
  "/data/dogs/generated-artwork-batch-m44.json",
  "/data/dogs/generated-artwork-batch-m45.json",
  "/data/dogs/generated-artwork-batch-m46.json",
  "/data/dogs/generated-artwork-batch-m47.json",
  "/data/dogs/generated-artwork-batch-m48.json",
  "/data/dogs/generated-artwork-batch-m49.json",
  "/data/dogs/generated-artwork-batch-m50.json",
  "/data/dogs/generated-artwork-batch-m51.json",
  "/data/dogs/generated-artwork-batch-m52.json",
  "/data/dogs/generated-artwork-batch-m53.json",
  "/data/dogs/generated-artwork-batch-m54.json",
  "/data/dogs/generated-artwork-batch-m55.json",
  "/data/dogs/generated-artwork-batch-m56.json",
  "/data/dogs/generated-artwork-batch-m57.json",
  "/data/dogs/generated-artwork-batch-m58.json",
  "/data/dogs/generated-artwork-batch-m59.json",
  "/data/dogs/generated-artwork-batch-m60.json",
  "/data/dogs/generated-artwork-batch-m61.json",
  "/data/dogs/generated-artwork-batch-m62.json",
  "/data/dogs/generated-artwork-batch-m63.json",
  "/data/dogs/generated-artwork-batch-m64.json",
  "/data/dogs/generated-artwork-batch-m65.json",
  "/data/dogs/generated-artwork-batch-m66.json",
  "/data/dogs/generated-artwork-batch-m67.json",
  "/data/dogs/generated-artwork-batch-m68.json",
  "/data/dogs/generated-artwork-batch-m69.json",
  "/data/dogs/generated-artwork-batch-m70.json",
  "/data/dogs/generated-artwork-batch-m71.json",
  "/data/dogs/generated-artwork-batch-m72.json",
  "/data/dogs/generated-artwork-batch-m73.json",
  "/data/dogs/generated-artwork-batch-m74.json",
  "/data/dogs/generated-artwork-batch-m75.json",
  "/data/dogs/generated-artwork-batch-m76.json",
  "/data/dogs/generated-artwork-batch-m77.json",
  "/data/dogs/generated-artwork-batch-m78.json",
  "/data/dogs/generated-artwork-batch-m79.json",
  "/data/dogs/generated-artwork-batch-m80.json",
  "/data/dogs/generated-artwork-batch-m81.json",
  "/data/dogs/generated-artwork-batch-m82.json",
  "/data/dogs/generated-artwork-batch-m83.json",
  "/data/dogs/generated-artwork-batch-m84.json",
  "/data/dogs/generated-artwork-batch-m85.json",
  "/data/dogs/generated-artwork-batch-m86.json",
  "/data/dogs/generated-artwork-batch-m87.json",
  "/data/dogs/generated-artwork-batch-m88.json",
  "/data/dogs/generated-artwork-batch-m89.json",
  "/data/dogs/generated-artwork-batch-m90.json",
  "/data/dogs/generated-artwork-batch-m91.json",
  "/data/dogs/generated-artwork-batch-m92.json",
  "/data/dogs/generated-artwork-batch-m94.json",
  "/data/dogs/generated-artwork-batch-m95.json",
  "/data/dogs/generated-artwork-batch-m96.json",
  "/data/dogs/generated-artwork-batch-m97.json",
  "/data/dogs/generated-artwork-batch-m98.json"
];
const L_BATCH_METADATA_URLS = [
  "/data/dogs/generated-artwork-batch-l01.json",
  "/data/dogs/generated-artwork-batch-l02.json",
  "/data/dogs/generated-artwork-batch-l03.json",
  "/data/dogs/generated-artwork-batch-l04.json",
  "/data/dogs/generated-artwork-batch-l05.json",
  "/data/dogs/generated-artwork-batch-l06.json",
  "/data/dogs/generated-artwork-batch-l07.json",
  "/data/dogs/generated-artwork-batch-l08.json",
  "/data/dogs/generated-artwork-batch-l09.json",
  "/data/dogs/generated-artwork-batch-l10.json",
  "/data/dogs/generated-artwork-batch-l11.json",
  "/data/dogs/generated-artwork-batch-l12.json",
  "/data/dogs/generated-artwork-batch-l13.json",
  "/data/dogs/generated-artwork-batch-l14.json",
  "/data/dogs/generated-artwork-batch-l15.json",
  "/data/dogs/generated-artwork-batch-l16.json",
  "/data/dogs/generated-artwork-batch-l17.json",
  "/data/dogs/generated-artwork-batch-l18.json",
  "/data/dogs/generated-artwork-batch-l19.json",
  "/data/dogs/generated-artwork-batch-l20.json",
  "/data/dogs/generated-artwork-batch-l21.json",
  "/data/dogs/generated-artwork-batch-l22.json",
  "/data/dogs/generated-artwork-batch-l23.json",
  "/data/dogs/generated-artwork-batch-l24.json",
  "/data/dogs/generated-artwork-batch-l25.json",
  "/data/dogs/generated-artwork-batch-l26.json",
  "/data/dogs/generated-artwork-batch-l27.json",
  "/data/dogs/generated-artwork-batch-l28.json",
  "/data/dogs/generated-artwork-batch-l29.json",
  "/data/dogs/generated-artwork-batch-l30.json",
  "/data/dogs/generated-artwork-batch-l31.json",
  "/data/dogs/generated-artwork-batch-l32.json",
  "/data/dogs/generated-artwork-batch-l33.json",
  "/data/dogs/generated-artwork-batch-l34.json",
  "/data/dogs/generated-artwork-batch-l35.json",
  "/data/dogs/generated-artwork-batch-l36.json",
  "/data/dogs/generated-artwork-batch-l37.json",
  "/data/dogs/generated-artwork-batch-l38.json",
  "/data/dogs/generated-artwork-batch-l39.json",
  "/data/dogs/generated-artwork-batch-l40.json",
  "/data/dogs/generated-artwork-batch-l41.json",
  "/data/dogs/generated-artwork-batch-l42.json",
  "/data/dogs/generated-artwork-batch-l43.json",
  "/data/dogs/generated-artwork-batch-l44.json",
  "/data/dogs/generated-artwork-batch-l45.json",
  "/data/dogs/generated-artwork-batch-l46.json",
  "/data/dogs/generated-artwork-batch-l47.json",
  "/data/dogs/generated-artwork-batch-l48.json",
  "/data/dogs/generated-artwork-batch-l49.json"
];

const BATCH_METADATA_URLS = [
  "/data/dogs/generated-artwork-batch-root.json",
  "/data/dogs/generated-artwork-batch-a.json",
  "/data/dogs/generated-artwork-batch-b.json",
  "/data/dogs/generated-artwork-batch-c.json",
  "/data/dogs/generated-artwork-batch-d.json",
  ...Array.from({ length: 10 }, (_, index) =>
    `/data/dogs/generated-artwork-batch-e${String(index + 1).padStart(2, "0")}.json`),
  "/data/dogs/generated-artwork-batch-f01.json",
  "/data/dogs/generated-artwork-batch-f02.json",
  "/data/dogs/generated-artwork-batch-f03.json",
  "/data/dogs/generated-artwork-batch-f04.json",
  "/data/dogs/generated-artwork-batch-g01.json",
  "/data/dogs/generated-artwork-batch-h01.json",
  "/data/dogs/generated-artwork-batch-h02.json",
  "/data/dogs/generated-artwork-batch-i01.json",
  "/data/dogs/generated-artwork-batch-i02.json",
  "/data/dogs/generated-artwork-batch-j01.json",
  "/data/dogs/generated-artwork-batch-j02.json",
  "/data/dogs/generated-artwork-batch-j03.json",
  "/data/dogs/generated-artwork-batch-k01.json",
  "/data/dogs/generated-artwork-batch-k02.json",
  "/data/dogs/generated-artwork-batch-k03.json",
  ...L_BATCH_METADATA_URLS,
  ...M_BATCH_METADATA_URLS,
  ...N_BATCH_METADATA_URLS,
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
  dialogFrame: document.querySelector(".dialog-frame"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogPrevious: document.querySelector("#dialog-previous"),
  dialogNext: document.querySelector("#dialog-next"),
  dialogPosition: document.querySelector("#dialog-position"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogCatalogId: document.querySelector("#dialog-catalog-id"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogProfile: document.querySelector("#dialog-profile"),
  dialogProfileTags: document.querySelector("#dialog-profile-tags"),
  dialogProfileSources: document.querySelector("#dialog-profile-sources"),
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
  dialogAssetIds: [],
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
        profileSources: dogProfileSourceLinks(profileMap[asset.catalogId], profiles.sources),
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

function filteredAssets() {
  return filterArtworkAssets(state.assets, {
    query: state.query,
    flaggedOnly: state.flaggedOnly,
    reviews: state.reviews.reviews,
  });
}

function render() {
  const page = paginateArtworkAssets(filteredAssets(), state.page, ARTWORK_REVIEW_PAGE_SIZE);
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
  dom.dialogProfileSources.replaceChildren();
  const coverage = profile?.reviewStatus === "editor-reviewed"
    ? "Individually written breed profile."
    : "Brief profile based on available name, classification, and origin records. A detailed breed profile has not yet been added.";
  dom.dialogProfileSources.append(make("summary", null, "Profile sources & notes"), make("p", "muted", coverage));
  for (const source of asset.profileSources) {
    const row = make("p");
    const link = make("a", null, source.title);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    row.append(link);
    dom.dialogProfileSources.append(row);
  }
  dom.dialogProfileSources.open = false;
}

function renderGenerationRecord(asset, modelText = "Checking preserved batch metadata…") {
  dom.generationRecord.replaceChildren();
  addDefinition(dom.generationRecord, "Asset ID", asset.assetId);
  addDefinition(dom.generationRecord, "Master SHA-256", asset.masterSha256 || "Not recorded");
  addDefinition(dom.generationRecord, "Generator", asset.generator || "Not recorded");
  addDefinition(dom.generationRecord, "Generated", formatGeneratedAt(asset.generatedAt));
  addDefinition(dom.generationRecord, "Prompt template", asset.promptTemplateVersion || "Not recorded");
  addDefinition(dom.generationRecord, "Model", modelText);
  if (asset.reference?.mode === "text-only") addDefinition(dom.generationRecord, "Image inputs", "None — generated from researched breed description");
  const sourcePage = asset.reference?.sourcePage;
  if (sourcePage) {
    const link = make("a", null, asset.reference?.mode === "text-only" ? "Open breed research source" : "Open morphology reference file page");
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
  // Keep this review sequence stable even when a flag is cleared in the dialog.
  if (!dom.dialog.open) state.dialogAssetIds = filteredAssets().map((item) => item.assetId);
  const requestId = ++state.dialogRequest;
  state.activeAssetId = assetId;
  if (opener) state.opener = opener;
  dom.dialogTitle.textContent = asset.name;
  dom.dialogCatalogId.textContent = asset.catalogId;
  const position = state.dialogAssetIds.indexOf(assetId);
  dom.dialogPosition.textContent = `${position + 1} of ${state.dialogAssetIds.length}`;
  dom.dialogPrevious.disabled = position <= 0;
  dom.dialogNext.disabled = position < 0 || position >= state.dialogAssetIds.length - 1;
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
  dom.dialogFrame.scrollTop = 0;
  (focusReview ? dom.concernOptions.querySelector("input") : dom.dialogClose)?.focus();

  try {
    const index = await loadBatchMetadata(state.manifestVersion);
    if (state.activeAssetId !== assetId || state.dialogRequest !== requestId) return;
    const batchImage = batchForAsset(index, asset);
    renderGenerationRecord(asset, batchImage?.imageModel || batchImage?.model || "Not recorded in preserved metadata");
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
  const position = filteredAssets().findIndex((asset) => asset.assetId === state.activeAssetId);
  if (position >= 0) {
    const page = Math.floor(position / ARTWORK_REVIEW_PAGE_SIZE) + 1;
    if (page !== state.page) {
      state.page = page;
      render();
    }
  }
  const opener = state.opener;
  state.dialogRequest += 1;
  state.activeAssetId = null;
  state.dialogAssetIds = [];
  if (dom.dialog.open) dom.dialog.close();
  dom.dialogImage.removeAttribute("src");
  requestAnimationFrame(() => {
    const selector = opener?.kind === "review" ? "[data-review-asset-id]" : "[data-asset-id]";
    const target = [...document.querySelectorAll(selector)].find((element) =>
      element.dataset.reviewAssetId === opener?.assetId || element.dataset.assetId === opener?.assetId);
    (target || dom.search || dom.filter)?.focus();
  });
}

function moveArtwork(direction) {
  if (!dom.dialog.open) return;
  const index = state.dialogAssetIds.indexOf(state.activeAssetId);
  const assetId = state.dialogAssetIds[index + direction];
  if (index < 0 || !assetId) return;
  openArtwork(assetId, { opener: { assetId, kind: "open" } });
}

function movePage(direction) {
  const control = direction < 0 ? dom.previous : dom.next;
  if (control.disabled) return;
  state.page += direction;
  render();
  // Rendering replaces focused cards, so give the new page a reliable keyboard target.
  dom.gallery.querySelector("[data-asset-id]")?.focus({ preventScroll: true });
  dom.gallery.scrollIntoView({ behavior: "smooth", block: "start" });
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
dom.previous.addEventListener("click", () => movePage(-1));
dom.next.addEventListener("click", () => movePage(1));
dom.dialogPrevious.addEventListener("click", () => moveArtwork(-1));
dom.dialogNext.addEventListener("click", () => moveArtwork(1));
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const field = event.target.closest("input, textarea, select");
  if ((field && field.type !== "checkbox") || event.target.isContentEditable) return;
  event.preventDefault();
  const direction = event.key === "ArrowLeft" ? -1 : 1;
  if (dom.dialog.open) moveArtwork(direction);
  else movePage(direction);
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
