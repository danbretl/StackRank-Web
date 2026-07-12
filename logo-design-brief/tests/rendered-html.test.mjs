import assert from "node:assert/strict";
import test from "node:test";

async function render(headers = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", ...headers },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("requires ChatGPT authentication for the design brief", async () => {
  const response = await render();

  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/signin-with-chatgpt");
  assert.equal(location.searchParams.get("return_to"), "/");
});

test("renders the complete identity brief for an authenticated reviewer", async () => {
  const response = await render({
    "oai-authenticated-user-email": "reviewer@example.com",
    "oai-authenticated-user-full-name": "Design%20Reviewer",
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>StackRank identity directions<\/title>/i);
  assert.match(html, /Ten ways to make preference visible\./);
  assert.match(html, /The brief behind the marks/);
  assert.match(html, /The directions/);
  assert.match(html, /Build from Rank Fold\./);
  assert.match(html, /Design Reviewer/);
  assert.match(html, /\/boards\/03-rank-fold\.webp/);
  assert.match(html, /\/boards\/08-open-slot\.webp/);
  assert.match(html, /\/boards\/05-pick-place\.webp/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});
