import { createClient } from "./vendor/supabase-js-2.108.2.js?v=1";
import {
  categorySharedPayloadFromPublicRow,
  categorySharedSlugFromPath,
} from "./lib/category-remote-persistence.js?v=4";
import { dogPublicSnapshotArtworkUrl } from "./lib/categories/dogs.js?v=9";

const SUPABASE_URL = "https://hrfhakrxsllrqmscxxpb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7GOGG6iSHMfax2YpOtqVqg_JIvcrBwl";
const CATEGORY = "dogs";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const page = document.querySelector(".dog-share");
const meta = document.getElementById("dog-share-meta");
const status = document.getElementById("dog-share-status");
const list = document.getElementById("dog-share-list");

const setState = (state, message) => {
  page.dataset.state = state;
  status.hidden = state === "ready";
  status.textContent = message || "";
  if (message) meta.textContent = message;
};

const formatDate = (value) => {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const render = (row) => {
  list.replaceChildren();
  row.payload.items.forEach((item, index) => {
    const card = document.createElement("li");
    card.className = "dog-share__card";
    const imageUrl = dogPublicSnapshotArtworkUrl(item.snapshot.image?.url, {
      supabaseOrigin: SUPABASE_URL,
    });
    if (imageUrl) {
      const media = document.createElement("div");
      media.className = "dog-share__media";
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.snapshot.image.alt || `${item.snapshot.primaryText} dog`;
      image.loading = "lazy";
      media.append(image);
      card.append(media);
    }
    const rank = document.createElement("span");
    rank.className = "dog-share__rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    copy.className = "dog-share__copy";
    const name = document.createElement("strong");
    name.textContent = item.snapshot.primaryText;
    const context = document.createElement("span");
    context.textContent = item.snapshot.secondaryText || "Dog breed or type";
    copy.append(name, context);
    card.append(rank, copy);
    list.append(card);
  });
  const date = formatDate(row.updated_at);
  meta.textContent = `${row.payload.items.length} ranked breed${row.payload.items.length === 1 ? "" : "s"}${date ? ` · Snapshot updated ${date}` : ""}`;
  setState("ready");
};

const load = async () => {
  const slug = categorySharedSlugFromPath(window.location.pathname, { category: CATEGORY });
  if (!slug) {
    setState("missing", "This Dogs shared-list link is not valid.");
    return;
  }
  try {
    const { data, error } = await supabase
      .from("category_shared_lists")
      .select("slug,category,payload,created_at,updated_at")
      .eq("slug", slug)
      .eq("category", CATEGORY)
      .maybeSingle();
    if (error) throw error;
    const row = categorySharedPayloadFromPublicRow(data, { category: CATEGORY });
    if (!row?.payload?.items?.length) {
      setState("missing", "This Dogs ranking is no longer available.");
      return;
    }
    render(row);
  } catch (error) {
    console.warn("Could not load shared Dogs ranking", error);
    setState("error", "Could not load this Dogs ranking. Try again later.");
  }
};

load();
