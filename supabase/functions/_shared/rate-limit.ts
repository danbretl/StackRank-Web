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

export const clientRateLimitKey = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") || "unknown";
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
  if (store.size > maxBuckets) {
    pruneRateLimitBuckets(store, now, windowMs);
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
