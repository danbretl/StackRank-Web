type RateLimitBucket = {
  tokens: number;
  updatedAt: number;
};

export type RateLimitStore = Map<string, RateLimitBucket>;

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  now?: number;
  maxBuckets?: number;
};

// These headers are only coarse client hints, not authenticated IP addresses.
// No hosted ingress overwrite guarantee has been established. Movies proxies
// also enforce a separate instance budget that never depends on this value.
export const clientRateLimitKey = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const hint = forwarded || req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") || "unknown";
  return hint.length <= 128 ? hint : "unknown";
};

const pruneRateLimitBuckets = (
  store: RateLimitStore,
  now: number,
  windowMs: number,
) => {
  for (const [key, bucket] of store) {
    if (now - bucket.updatedAt > windowMs * 2) {
      store.delete(key);
    }
  }
};

export const takeRateLimitToken = (
  store: RateLimitStore,
  key: string,
  { limit, windowMs, now = Date.now(), maxBuckets = 5000 }: RateLimitOptions,
) => {
  if (!store.has(key) && store.size >= maxBuckets) {
    pruneRateLimitBuckets(store, now, windowMs);
    // Do not evict live buckets: rotating hints must not reset existing limits.
    // Reject new hints until space expires, keeping memory strictly bounded.
    if (store.size >= maxBuckets) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(windowMs * 2 / 1000)),
      };
    }
  }

  const refillPerMs = limit / windowMs;
  const previous = store.get(key);
  const elapsed = previous ? Math.max(0, now - previous.updatedAt) : 0;
  const tokens = previous
    ? Math.min(limit, previous.tokens + elapsed * refillPerMs)
    : limit;

  if (tokens < 1) {
    store.set(key, { tokens, updatedAt: now });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((1 - tokens) / refillPerMs / 1000),
      ),
    };
  }

  const remaining = tokens - 1;
  store.set(key, { tokens: remaining, updatedAt: now });
  return {
    allowed: true,
    remaining: Math.floor(remaining),
    retryAfterSeconds: 0,
  };
};

// Both budgets are ephemeral and local to one function instance. The aggregate
// brake bounds header rotation in that instance; it is not a fleet-wide quota.
export const createRequestRateLimiter = (
  options: Omit<RateLimitOptions, "now"> & { instanceLimit: number },
) => {
  const hints: RateLimitStore = new Map();
  const instance: RateLimitStore = new Map();
  return (req: Request) => {
    const now = Date.now();
    const hintToken = takeRateLimitToken(hints, clientRateLimitKey(req), {
      ...options,
      now,
    });
    if (!hintToken.allowed) return hintToken;
    return takeRateLimitToken(instance, "instance", {
      limit: options.instanceLimit,
      windowMs: options.windowMs,
      now,
      maxBuckets: 1,
    });
  };
};
