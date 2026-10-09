import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_SHARE_AUTH_OPTIONS, readPublicShare } from "../lib/public-share-reader.js";

const fixture = (rpcResult, tableResult = { data: null, error: null }) => {
  const calls = [];
  const query = { select: (...args) => (calls.push(["select", ...args]), query),
    eq: (...args) => (calls.push(["eq", ...args]), query),
    maybeSingle: async () => tableResult };
  return { calls, rpc: (...args) => (calls.push(["rpc", ...args]), { maybeSingle: async () => rpcResult }),
    from: (...args) => (calls.push(["from", ...args]), query) };
};

test("public viewers neither persist, refresh nor consume an account session", () => {
  assert.deepEqual(PUBLIC_SHARE_AUTH_OPTIONS, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});

test("exact-slug public lookup chooses the category RPC and returns its public row", async () => {
  for (const category of ["movies", "dogs"]) {
    const slug = category === "dogs" ? "abcdefgh1234" : "abcdefgh12";
    const data = { slug, payload: {}, updated_at: "2026-10-09", ...(category === "dogs" ? { category } : {}) };
    const client = fixture({ data, error: null });
    assert.deepEqual(await readPublicShare(client, { category, slug }), { data, error: null });
    assert.deepEqual(client.calls, [["rpc", category === "dogs" ? "read_dog_share" : "read_movie_share", { share_slug: slug }]]);
  }
});

test("only a missing RPC enables the temporary legacy read; no other error or absent row downgrades", async () => {
  const row = { payload: {}, updated_at: "2026-10-09" };
  const client = fixture({ data: null, error: { code: "PGRST202" } }, { data: row, error: null });
  assert.equal((await readPublicShare(client, { category: "movies", slug: "abcdefgh12" })).data, row);
  assert.deepEqual(client.calls.slice(1), [["from", "shared_lists"], ["select", "payload, updated_at"], ["eq", "slug", "abcdefgh12"], ["eq", "revoked", false]]);
  for (const error of [null, { code: "42501" }, { code: "500" }, { code: "PGRST116" }]) {
    const client = fixture({ data: null, error });
    assert.deepEqual(await readPublicShare(client, { category: "movies", slug: "abcdefgh12" }), { data: null, error });
    assert.equal(client.calls.length, 1);
  }
});

test("malformed slugs and categories make no request; overbroad or mismatched rows are rejected", async () => {
  for (const input of [{ category: "movies", slug: "../abc" }, { category: "dogs", slug: "abcdefgh12" }, { category: "books", slug: "abcdefgh12" }]) {
    const client = fixture({ data: null, error: null });
    assert.equal((await readPublicShare(client, input)).data, null);
    assert.equal(client.calls.length, 0);
  }
  for (const data of [{ list_id: "user:foreign", payload: {} }, { slug: "foreign123", payload: {} }, []]) {
    const result = await readPublicShare(fixture({ data, error: null }), { category: "movies", slug: "abcdefgh12" });
    assert.equal(result.data, null);
    assert.ok(result.error);
  }
});
