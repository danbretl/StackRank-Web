export const PRODUCT_EVENT_NAMES = Object.freeze([
  "session_started",
  "ranking_started",
  "ranking_completed",
  "ranking_canceled",
  "review_started",
  "review_completed",
  "pack_opened",
  "pack_browser_opened",
  "pack_rank_all_started",
  "pack_rank_all_stopped",
  "share_opened",
  "share_exported",
  "import_opened",
  "import_completed",
  "quick_start_shown",
  "quick_start_pack_opened",
  "quick_start_import_opened",
  "taste_explorer_opened",
  "taste_lens_opened",
]);

const PRODUCT_EVENT_SET = new Set(PRODUCT_EVENT_NAMES);
const PROPERTY_KEYS = new Set(["source", "list_size", "count", "format", "outcome", "signed_in"]);
const COUNT_BUCKETS = ["0", "1", "2_4", "5_9", "10_24", "25_49", "50_99", "100_plus"];
const PROPERTY_VALUES = {
  source: new Set([
    "empty",
    "returning",
    "search",
    "restack",
    "fullscreen_restack",
    "watch_queue",
    "hidden_queue",
    "suggestion_related",
    "suggestion_essentials",
    "suggestion_popular",
    "suggestion_unknown",
    "pack_auto",
    "pack_browse",
    "settings",
    "home",
    "pack_card",
    "discovery",
    "quick_start",
    "taste",
    "unknown",
  ]),
  list_size: new Set(COUNT_BUCKETS),
  count: new Set(COUNT_BUCKETS),
  format: new Set([
    "single",
    "set",
    "svg",
    "svg_single",
    "svg_zip",
    "png",
    "png_page",
    "png_single",
    "png_zip",
    "native_single",
    "native_set",
    "markdown",
    "json",
    "text",
  ]),
  outcome: new Set(["completed", "ended", "canceled", "failed"]),
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const countBucket = (value) => {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  if (count === 0) return "0";
  if (count === 1) return "1";
  if (count <= 4) return "2_4";
  if (count <= 9) return "5_9";
  if (count <= 24) return "10_24";
  if (count <= 49) return "25_49";
  if (count <= 99) return "50_99";
  return "100_plus";
};

export const sanitizeProductEventProperties = (properties = {}) => {
  const safe = {};
  Object.entries(properties || {}).forEach(([key, value]) => {
    if (!PROPERTY_KEYS.has(key)) return;
    if (key === "signed_in" && typeof value === "boolean") {
      safe[key] = value;
      return;
    }
    if (typeof value === "string" && PROPERTY_VALUES[key]?.has(value)) {
      safe[key] = value;
    }
  });
  return safe;
};

export const buildProductEvent = ({ eventName, sessionId, properties = {} } = {}) => {
  if (!PRODUCT_EVENT_SET.has(eventName) || !UUID.test(String(sessionId || ""))) return null;
  return {
    event_name: eventName,
    session_id: sessionId,
    properties: sanitizeProductEventProperties(properties),
  };
};

export const shouldCollectProductTelemetry = ({
  hostname,
  doNotTrack = "",
  globalPrivacyControl = false,
} = {}) =>
  hostname === "www.stackrankapp.com" &&
  doNotTrack !== "1" &&
  doNotTrack !== "yes" &&
  globalPrivacyControl !== true;
