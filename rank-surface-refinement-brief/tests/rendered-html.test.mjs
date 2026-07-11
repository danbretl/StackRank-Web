import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the complete responsive Rank surface brief", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Make the Action Feel Inevitable/i);
  assert.match(html, /Measured lift/);
  assert.match(html, /Spotlight field/);
  assert.match(html, /Purposefully oversized/);
  assert.match(html, /Resting/);
  assert.match(html, /Results/);
  assert.match(html, /iPad/);
  assert.match(html, /iPhone/);
  assert.match(html, /Segmented states/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("removes the disposable starter preview", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
