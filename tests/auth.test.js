import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_PROVIDERS,
  SIGN_OUT_LOCAL_DATA_MESSAGE,
  enabledOAuthProviders,
  signInRedirectUrl,
  isLikelyEmail,
  normalizeAuthEmail,
} from "../lib/auth.js";

test("AUTH_PROVIDERS offers Google and Apple with literal Supabase ids", () => {
  const ids = AUTH_PROVIDERS.map((p) => p.provider);
  assert.deepEqual(ids, ["google", "apple"]);
  for (const p of AUTH_PROVIDERS) {
    assert.ok(p.id, "provider needs an id");
    assert.ok(p.label, "provider needs a label");
  }
});

test("SIGN_OUT_LOCAL_DATA_MESSAGE is explicit about the account copy and device state", () => {
  assert.equal(
    SIGN_OUT_LOCAL_DATA_MESSAGE,
    "Sign out? Your list stays in your account; this device will show an empty list.",
  );
});

test("enabledOAuthProviders follows the hosted Supabase provider settings", () => {
  assert.deepEqual(
    enabledOAuthProviders({ external: { google: true, apple: false } }).map(
      ({ provider }) => provider,
    ),
    ["google"],
  );
  assert.deepEqual(
    enabledOAuthProviders({ external: { google: true, apple: true } }).map(
      ({ provider }) => provider,
    ),
    ["google", "apple"],
  );
  assert.deepEqual(enabledOAuthProviders({ external: {} }), []);
  assert.deepEqual(enabledOAuthProviders(null), []);
});

test("signInRedirectUrl returns the movies path for canonical production hosts", () => {
  assert.equal(
    signInRedirectUrl({
      hostname: "www.stackrankapp.com",
      origin: "https://www.stackrankapp.com",
      pathname: "/movies",
    }),
    "https://www.stackrankapp.com/movies",
  );
  assert.equal(
    signInRedirectUrl({
      hostname: "stackrankapp.com",
      origin: "https://stackrankapp.com",
      pathname: "/",
    }),
    "https://stackrankapp.com/movies",
  );
});

test("signInRedirectUrl preserves root-based local development", () => {
  assert.equal(
    signInRedirectUrl({
      hostname: "localhost",
      origin: "http://localhost:8000",
      pathname: "/",
    }),
    "http://localhost:8000",
  );
});

test("signInRedirectUrl keeps /movies on previews and local route-aware servers", () => {
  assert.equal(
    signInRedirectUrl({
      hostname: "stackrank-git-feature-danbretl-2590s-projects.vercel.app",
      origin: "https://stackrank-git-feature-danbretl-2590s-projects.vercel.app",
      pathname: "/movies",
    }),
    "https://stackrank-git-feature-danbretl-2590s-projects.vercel.app/movies",
  );
  assert.equal(
    signInRedirectUrl({
      hostname: "localhost",
      origin: "http://localhost:8000",
      pathname: "/movies",
    }),
    "http://localhost:8000/movies",
  );
});

test("signInRedirectUrl keeps the legacy GitHub Pages sub-path", () => {
  assert.equal(
    signInRedirectUrl({
      hostname: "danbretl.github.io",
      origin: "https://danbretl.github.io",
      pathname: "/StackRank-Web/",
    }),
    "https://danbretl.github.io/StackRank-Web/",
  );
});

test("signInRedirectUrl does not treat lookalike hosts as GitHub Pages", () => {
  assert.equal(
    signInRedirectUrl({
      hostname: "danbretl.github.io.example.com",
      origin: "https://danbretl.github.io.example.com",
      pathname: "/",
    }),
    "https://danbretl.github.io.example.com",
  );
});

test("signInRedirectUrl is defensive about missing input", () => {
  assert.equal(signInRedirectUrl(null), "");
  assert.equal(signInRedirectUrl({}), "");
});

test("isLikelyEmail accepts plausible addresses and rejects junk", () => {
  assert.equal(isLikelyEmail("you@email.com"), true);
  assert.equal(isLikelyEmail("  dan@stackrankapp.com  "), true);
  assert.equal(isLikelyEmail(""), false);
  assert.equal(isLikelyEmail("not-an-email"), false);
  assert.equal(isLikelyEmail("missing@domain"), false);
  assert.equal(isLikelyEmail("two @spaces.com"), false);
  assert.equal(isLikelyEmail(null), false);
  assert.equal(isLikelyEmail(42), false);
});

test("normalizeAuthEmail trims and tolerates non-strings", () => {
  assert.equal(normalizeAuthEmail("  a@b.co "), "a@b.co");
  assert.equal(normalizeAuthEmail(""), "");
  assert.equal(normalizeAuthEmail(undefined), "");
});
