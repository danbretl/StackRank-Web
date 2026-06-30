export const SHARE_OPTIONS_VERSION = 7;

const FULL_LIST_STYLES = new Set(["posters", "text", "mixed"]);
const THEMES = new Set(["classic", "cinema", "warm", "marquee", "pop"]);
const TONES = new Set(["neutral", "punchy", "funny", "extreme"]);

const isObjectRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function createDefaultShareOptions() {
  return {
    version: SHARE_OPTIONS_VERSION,
    displayName: "",
    top: true,
    bottom: true,
    eras: true,
    genres: true,
    people: true,
    queues: true,
    packs: true,
    fullList: true,
    fullListStyle: "mixed",
    theme: "classic",
    tone: "neutral",
    format: "single",
    shape: "skinny",
  };
}

export function normalizeShareOptions(parsed) {
  if (!isObjectRecord(parsed)) {
    throw new TypeError("Share options must be an object");
  }
  const hasV2 = Number(parsed.version) >= 2;
  const hasV3 = Number(parsed.version) >= 3;
  const hasV5 = Number(parsed.version) >= 5;
  return {
    version: SHARE_OPTIONS_VERSION,
    displayName: typeof parsed.displayName === "string" ? parsed.displayName.slice(0, 36) : "",
    top: parsed.top !== false,
    bottom: hasV2 ? parsed.bottom !== false : true,
    eras: hasV3 ? parsed.eras !== false : parsed.decades !== false || parsed.range !== false,
    genres: hasV3 ? parsed.genres !== false : true,
    people: hasV3 ? parsed.people !== false : true,
    queues: hasV3 ? parsed.queues !== false : true,
    // Added in v7 and intentionally defaults on for older saved preferences.
    packs: parsed.packs !== false,
    fullList: hasV3 ? parsed.fullList !== false : true,
    fullListStyle: hasV5 && FULL_LIST_STYLES.has(parsed.fullListStyle)
      ? parsed.fullListStyle
      : "mixed",
    theme: THEMES.has(parsed.theme) ? parsed.theme : "classic",
    tone: TONES.has(parsed.tone)
      ? parsed.tone
      : parsed.tone === "savage"
        ? "extreme"
        : "neutral",
    format: parsed.format === "set" ? "set" : "single",
    // v6 originally called these portrait/landscape; retain that migration.
    shape: parsed.shape === "wide" || parsed.shape === "landscape" ? "wide" : "skinny",
  };
}

export function parseShareOptions(raw) {
  if (typeof raw !== "string" || !raw) {
    throw new TypeError("Share options must be serialized JSON");
  }
  return normalizeShareOptions(JSON.parse(raw));
}
