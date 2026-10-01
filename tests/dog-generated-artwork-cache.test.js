import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canReuseDogArtworkVariant } from "../scripts/dog-generated-artwork-cache.mjs";

const fixture = () => {
  const bytes = Buffer.from("preserved accepted WebP bytes");
  return {
    asset: { sourceType: "ai-generated", generator: "OpenAI built-in imagegen", review: { status: "approved" },
      uiDisplayAllowed: true, publicSnapshotAllowed: false, rasterExportAllowed: false, masterSha256: "native-master-hash" },
    masterSha256: "native-master-hash",
    target: { role: "detail", width: 960, height: 640 },
    expectedUrl: "assets/dogs/generated/native-960.webp", bytes,
    variant: { role: "detail", width: 960, height: 640, mime: "image/webp", url: "assets/dogs/generated/native-960.webp",
      bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
  };
};

test("accepted native-master variants can be preserved byte for byte", () => {
  assert.equal(canReuseDogArtworkVariant(fixture()), true);
});

test("a regenerated native master requires new encodings", () => {
  const args = fixture(); args.masterSha256 = "new-native-master";
  assert.equal(canReuseDogArtworkVariant(args), false);
});

test("corrupted or truncated WebP bytes cannot be reused", () => {
  for (const bytes of [Buffer.from("preserved accepted WebP byteZ"), Buffer.from("short")]) {
    assert.equal(canReuseDogArtworkVariant({ ...fixture(), bytes }), false);
  }
});

test("different delivery dimensions, role or path require encoding", () => {
  for (const patch of [{ width: 320 }, { height: 641 }, { role: "card" }, { url: "assets/dogs/generated/other-960.webp" }, { mime: "image/png" }]) {
    const args = fixture(); args.variant = { ...args.variant, ...patch };
    assert.equal(canReuseDogArtworkVariant(args), false);
  }
});

test("unapproved artwork and broader purpose gates cannot enter the cache", () => {
  for (const patch of [{ review: { status: "pending" } }, { uiDisplayAllowed: false }, { publicSnapshotAllowed: true },
    { rasterExportAllowed: true }, { sourceType: "licensed-photo" }, { generator: "other service" }]) {
    const args = fixture(); args.asset = { ...args.asset, ...patch };
    assert.equal(canReuseDogArtworkVariant(args), false);
  }
});
