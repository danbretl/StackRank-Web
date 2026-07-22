// DOM-free auth helpers shared by the app and the test suite. The Supabase
// calls themselves live in app.js (they need the live client + DOM); everything
// here is pure so it can be unit-tested without a browser.

// OAuth providers offered alongside the email magic link. Order is the render
// order in the sign-in view. `provider` is the literal id Supabase expects in
// `signInWithOAuth({ provider })`; keep it in sync with the providers enabled in
// supabase/config.toml and the Supabase dashboard.
export const AUTH_PROVIDERS = [
  { id: "google", provider: "google", label: "Continue with Google" },
  { id: "apple", provider: "apple", label: "Continue with Apple" },
];

export const SIGN_OUT_LOCAL_DATA_MESSAGE =
  "Sign out? Your list stays in your account; this device will show an empty list.";

// Supabase exposes enabled provider flags from its public Auth settings
// endpoint. Keep unavailable providers out of the UI so a partially configured
// production rollout never leaves users with a button that can only fail.
export function enabledOAuthProviders(settings) {
  const external = settings?.external;
  if (!external || typeof external !== "object") return [];
  return AUTH_PROVIDERS.filter(({ provider }) => external[provider] === true);
}

const MOVIES_PATH = "/movies";
const CATEGORY_PATH_PATTERN = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeCategoryPath = (value) =>
  CATEGORY_PATH_PATTERN.test(String(value || "")) ? String(value) : MOVIES_PATH;

// Where Supabase should send the user back after a magic link or OAuth round
// trip. The canonical production app and Vercel previews return to /movies.
// Root-based local development remains supported, and the legacy GitHub Pages
// recovery host keeps its repository sub-path.
export function signInRedirectUrl(location, canonicalPath = MOVIES_PATH) {
  if (!location) return "";
  const hostname = location.hostname || "";
  const origin = location.origin || "";
  const pathname = location.pathname || "";
  const categoryPath = normalizeCategoryPath(canonicalPath);
  if (hostname === "danbretl.github.io") {
    return `${origin}/StackRank-Web/`;
  }
  if (
    hostname === "www.stackrankapp.com" ||
    hostname === "stackrankapp.com" ||
    pathname === categoryPath ||
    pathname.startsWith(`${categoryPath}/`)
  ) {
    return `${origin}${categoryPath}`;
  }
  return origin;
}

// Permissive client-side check so we can give an instant "that doesn't look like
// an email" hint before bothering Supabase. Real validation is server-side; this
// just catches empty/obviously-wrong input.
export function isLikelyEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeAuthEmail(value) {
  return typeof value === "string" ? value.trim() : "";
}
