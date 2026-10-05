import crypto from "node:crypto";

// Use the caller's request function for both requests, preserving throttling,
// mitigation handling and redirect policy when HEAD needs a body fallback.
export const verifyPublicResponse = async ({ entry, url, hashBody, request }) => {
  const method = hashBody ? "GET" : "HEAD";
  let response = await request(url, method);
  const result = { path: entry.path, status: response.status, method };
  if (!hashBody) {
    const rawLength = response.headers.get("content-length");
    const length = rawLength !== null && /^\d+$/.test(rawLength) ? Number(rawLength) : NaN;
    if (Number.isSafeInteger(length) && length >= 0) {
      result.lengthMatch = length === entry.bytes;
    } else if (response.status === 200) {
      // A successful HEAD without a trustworthy length provides no byte evidence.
      result.headFallback = true;
      response = await request(url, "GET");
      result.method = "GET";
      result.status = response.status;
      hashBody = true;
    }
  }
  if (hashBody) {
    const body = Buffer.from(await response.arrayBuffer());
    result.sha256Match = body.length === entry.bytes && crypto.createHash("sha256").update(body).digest("hex") === entry.sha256;
  }
  const bytesVerified = response.status === 200 && (result.sha256Match === true || result.lengthMatch === true);
  return { response, result, bytesVerified };
};
