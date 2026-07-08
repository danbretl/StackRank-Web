import { clientRateLimitKey, takeRateLimitToken } from "./rate-limit.ts";

Deno.test("clientRateLimitKey prefers the first forwarded IP", () => {
  const req = new Request("https://example.test", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.2",
      "cf-connecting-ip": "203.0.113.20",
    },
  });

  if (clientRateLimitKey(req) !== "203.0.113.10") {
    throw new Error("Expected first x-forwarded-for address to be used");
  }
});

Deno.test("clientRateLimitKey falls back through common proxy headers", () => {
  const cfReq = new Request("https://example.test", {
    headers: { "cf-connecting-ip": "203.0.113.20" },
  });
  if (clientRateLimitKey(cfReq) !== "203.0.113.20") {
    throw new Error("Expected cf-connecting-ip fallback");
  }

  const realIpReq = new Request("https://example.test", {
    headers: { "x-real-ip": "203.0.113.30" },
  });
  if (clientRateLimitKey(realIpReq) !== "203.0.113.30") {
    throw new Error("Expected x-real-ip fallback");
  }

  if (clientRateLimitKey(new Request("https://example.test")) !== "unknown") {
    throw new Error("Expected unknown fallback");
  }
});

Deno.test("takeRateLimitToken allows the configured burst then returns retry guidance", () => {
  const store = new Map();
  const options = { limit: 3, windowMs: 3000, now: 0 };

  const first = takeRateLimitToken(store, "client", options);
  const second = takeRateLimitToken(store, "client", options);
  const third = takeRateLimitToken(store, "client", options);
  const fourth = takeRateLimitToken(store, "client", options);

  if (!first.allowed || first.remaining !== 2) {
    throw new Error(`Unexpected first result: ${JSON.stringify(first)}`);
  }
  if (!second.allowed || second.remaining !== 1) {
    throw new Error(`Unexpected second result: ${JSON.stringify(second)}`);
  }
  if (!third.allowed || third.remaining !== 0) {
    throw new Error(`Unexpected third result: ${JSON.stringify(third)}`);
  }
  if (fourth.allowed || fourth.retryAfterSeconds !== 1) {
    throw new Error(`Unexpected exhausted result: ${JSON.stringify(fourth)}`);
  }
});

Deno.test("takeRateLimitToken refills over time up to the configured limit", () => {
  const store = new Map();
  takeRateLimitToken(store, "client", { limit: 2, windowMs: 2000, now: 0 });
  takeRateLimitToken(store, "client", { limit: 2, windowMs: 2000, now: 0 });

  const blocked = takeRateLimitToken(store, "client", {
    limit: 2,
    windowMs: 2000,
    now: 500,
  });
  if (blocked.allowed) {
    throw new Error("Expected request before enough refill to be blocked");
  }

  const refilled = takeRateLimitToken(store, "client", {
    limit: 2,
    windowMs: 2000,
    now: 1000,
  });
  if (!refilled.allowed || refilled.remaining !== 0) {
    throw new Error(
      `Expected one refilled token, got ${JSON.stringify(refilled)}`,
    );
  }

  const full = takeRateLimitToken(store, "client", {
    limit: 2,
    windowMs: 2000,
    now: 5000,
  });
  if (!full.allowed || full.remaining !== 1) {
    throw new Error(
      `Expected bucket to cap at the full limit, got ${JSON.stringify(full)}`,
    );
  }
});
