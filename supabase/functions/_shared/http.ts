const STACKRANK_PRODUCTION_ORIGINS = new Set([
  "https://www.stackrankapp.com",
  "https://stackrankapp.com",
  "https://danbretl.github.io",
]);

const VERCEL_PREVIEW_HOST_RE =
  /^stackrank-[a-z0-9-]+-danbretl-2590s-projects\.vercel\.app$/;

const LOCAL_PRIVATE_HOST_RE =
  /^(localhost|\[::1\]|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

const CORS_ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const CORS_ALLOW_METHODS = "GET, OPTIONS";

export const PUBLIC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
  "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
};

const appendVary = (current: string | null, value: string) => {
  if (!current) return value;
  const parts = current.split(",").map((part) => part.trim().toLowerCase());
  return parts.includes(value.toLowerCase()) ? current : `${current}, ${value}`;
};

export const allowedStackRankOrigin = (
  origin: string | null,
): string | null => {
  if (!origin) return null;
  if (STACKRANK_PRODUCTION_ORIGINS.has(origin)) return origin;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch (_error) {
    return null;
  }

  if (
    parsed.protocol === "https:" && VERCEL_PREVIEW_HOST_RE.test(parsed.hostname)
  ) {
    return origin;
  }

  if (
    parsed.protocol === "http:" && LOCAL_PRIVATE_HOST_RE.test(parsed.hostname)
  ) {
    return origin;
  }

  return null;
};

export const stackRankCorsHeaders = (
  req: Request,
  extraHeaders: HeadersInit = {},
) => {
  const headers = new Headers(extraHeaders);
  headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  headers.set("Vary", appendVary(headers.get("Vary"), "Origin"));

  const allowedOrigin = allowedStackRankOrigin(req.headers.get("Origin"));
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  return headers;
};

export const jsonResponse = (
  body: unknown,
  status = 200,
  headersInit: HeadersInit = {},
) => {
  const headers = new Headers(headersInit);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { headers, status });
};

export const preflightResponse = (headersInit: HeadersInit) =>
  new Response("ok", { headers: headersInit, status: 200 });

export const rejectDisallowedBrowserOrigin = (req: Request) => {
  const origin = req.headers.get("Origin");
  if (!origin || allowedStackRankOrigin(origin)) return null;
  return jsonResponse(
    { error: "Origin not allowed" },
    403,
    stackRankCorsHeaders(req),
  );
};

export const stackRankPreflightResponse = (req: Request) =>
  rejectDisallowedBrowserOrigin(req) ||
  preflightResponse(stackRankCorsHeaders(req));
