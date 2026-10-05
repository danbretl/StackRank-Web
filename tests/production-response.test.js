import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyPublicResponse } from "../deploy/production-response.mjs";

const body = Buffer.from("portrait bytes");
const entry = { path: "assets/dogs/generated/example.webp", bytes: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") };
const url = `https://example.test/${entry.path}`;
const run = async ({ length = String(body.length), headStatus = 200, getStatus = 200, getBody = body, hashBody = false } = {}) => {
  const methods = [];
  const verified = await verifyPublicResponse({ entry, url, hashBody, request: async (requestedUrl, method) => {
    assert.equal(requestedUrl, url);
    methods.push(method);
    if (method === "HEAD") return new Response(null, { status: headStatus, headers: length === null ? {} : { "content-length": length } });
    return new Response(getBody, { status: getStatus, headers: { "content-type": "image/webp", "cache-control": "public, max-age=60" } });
  } });
  return { ...verified, methods };
};

test("HEAD passes only with an exact valid length and successful status", async () => {
  const valid = await run();
  assert.equal(valid.bytesVerified, true);
  assert.deepEqual(valid.methods, ["HEAD"]);
  assert.equal(valid.result.lengthMatch, true);
  for (const length of ["0", String(body.length + 1)]) {
    const wrong = await run({ length });
    assert.equal(wrong.bytesVerified, false);
    assert.equal(wrong.result.lengthMatch, false);
    assert.deepEqual(wrong.methods, ["HEAD"]);
  }
  for (const headStatus of [302, 403, 404, 500]) {
    const failed = await run({ headStatus });
    assert.equal(failed.bytesVerified, false);
    assert.deepEqual(failed.methods, ["HEAD"]);
  }
});

test("missing or invalid HEAD lengths require GET bytes and SHA-256", async () => {
  for (const length of [null, "", "unknown", "-1", "1.5", "1e2", "9007199254740992"]) {
    const verified = await run({ length });
    assert.equal(verified.bytesVerified, true, String(length));
    assert.deepEqual(verified.methods, ["HEAD", "GET"]);
    assert.equal(verified.result.headFallback, true);
    assert.equal(verified.result.method, "GET");
    assert.equal(verified.result.sha256Match, true);
    // The caller must validate the final GET's MIME/cache headers, not the HEAD's.
    assert.equal(verified.response.headers.get("content-type"), "image/webp");
    assert.equal(verified.response.headers.get("cache-control"), "public, max-age=60");
  }
});

test("missing-length HEAD cannot hide wrong bytes or a failing GET", async () => {
  for (const getBody of [Buffer.alloc(body.length, 120), Buffer.from("short")]) {
    const wrong = await run({ length: null, getBody });
    assert.equal(wrong.bytesVerified, false);
    assert.equal(wrong.result.sha256Match, false);
  }
  const failed = await run({ length: null, getStatus: 404 });
  assert.equal(failed.bytesVerified, false);
  assert.equal(failed.result.status, 404);
  const headFailed = await run({ length: null, headStatus: 404 });
  assert.equal(headFailed.bytesVerified, false);
  assert.deepEqual(headFailed.methods, ["HEAD"]);
});

test("full hash checks work for Movies and Dogs without HEAD", async () => {
  for (const path of ["lib/share-svg.js", "assets/dogs/generated/example.webp"]) {
    const result = await verifyPublicResponse({ entry: { ...entry, path }, url, hashBody: true, request: async (_, method) => {
      assert.equal(method, "GET");
      return new Response(body);
    } });
    assert.equal(result.bytesVerified, true);
    assert.equal(result.result.path, path);
  }
  assert.equal((await run({ hashBody: true, getBody: "wrong" })).bytesVerified, false);
});

test("GET fallback preserves request errors and mitigation blocking", async () => {
  const blocked = new Error("mitigation blocked");
  await assert.rejects(verifyPublicResponse({ entry, url, hashBody: false, request: async (_, method) => {
    if (method === "HEAD") return new Response(null);
    throw blocked;
  } }), (error) => error === blocked);
});
