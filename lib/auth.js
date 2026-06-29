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

// Supabase exposes enabled provider flags from its public Auth settings
// endpoint. Keep unavailable providers out of the UI so a partially configured
// production rollout never leaves users with a button that can only fail.
export function enabledOAuthProviders(settings) {
  const external = settings?.external;
  if (!external || typeof external !== "object") return [];
  return AUTH_PROVIDERS.filter(({ provider }) => external[provider] === true);
}

// Where Supabase should send the user back after a magic link or OAuth round
// trip. Auth is origin-scoped, so we always return to the current origin — with
// the one exception of the legacy GitHub Pages host, which serves the app from a
// /StackRank-Web/ sub-path rather than the origin root.
export function signInRedirectUrl(location) {
  if (!location) return "";
  const hostname = location.hostname || "";
  const origin = location.origin || "";
  if (hostname === "danbretl.github.io") {
    return `${origin}/StackRank-Web/`;
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
