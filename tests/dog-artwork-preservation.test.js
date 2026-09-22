import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { preserveDogArtwork } from "../scripts/preserve-dog-artwork.mjs";

test("additive portrait builds preserve existing bytes and modification times, and reject replacements", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dogs-preserve-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "portrait.webp");
  const original = Buffer.from("reviewed portrait bytes");
  assert.equal(await preserveDogArtwork(file, original), "created");
  await fs.utimes(file, new Date(0), new Date(0));
  assert.equal(await preserveDogArtwork(file, original), "unchanged");
  assert.equal((await fs.stat(file)).mtimeMs, 0);
  await assert.rejects(preserveDogArtwork(file, Buffer.from("changed encoder or master")), /Refusing to overwrite/);
  assert.deepEqual(await fs.readFile(file), original);
});

test("portrait check mode never creates or repairs output", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dogs-check-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "missing.webp");
  await assert.rejects(preserveDogArtwork(file, Buffer.from("new"), { checkOnly: true }), /Missing portrait/);
  await assert.rejects(fs.stat(file), { code: "ENOENT" });
});
