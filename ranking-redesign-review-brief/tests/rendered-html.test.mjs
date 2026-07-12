import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("https://review.example/", { headers: { accept: "text/html", host: "review.example" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the implementation review", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>StackRank · Rank \/ Ranking \/ You implementation review<\/title>/i);
  assert.match(html, /Rank\. Ranking\. You\./);
  assert.match(html, /Density must not hide how order changes/);
  assert.match(html, /What I would review first/);
  assert.match(html, /\/screens\/desktop-rank\.png/);
  assert.match(html, /https:\/\/review\.example\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps responsive captures and removes starter scaffolding", async () => {
  const [page, layout, packageJson, screens] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../public/screens/", import.meta.url)),
  ]);

  assert.equal(screens.filter((file) => file.endsWith(".png")).length, 30);
  assert.match(page, /iphone-landscape/);
  assert.match(page, /setDevice\(key\)/);
  assert.match(page, /Filtered/);
  assert.match(layout, /x-forwarded-host/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
