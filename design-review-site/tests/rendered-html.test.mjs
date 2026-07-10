import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete StackRank strategy site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Ranking Is the Verb — StackRank Home Strategy<\/title>/i);
  assert.match(html, /Ranking is/);
  assert.match(html, /the verb/);
  assert.match(html, /The “Rank Next” rail/);
  assert.match(html, /Rank as the launchpad/);
  assert.match(html, /Guided ranking sessions/);
  assert.match(html, /Choose Option 2/);
  assert.match(html, /Desktop/);
  assert.match(html, /iPad/);
  assert.match(html, /iPhone/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});
