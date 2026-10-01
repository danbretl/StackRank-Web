import { createHash } from "node:crypto";

// Existing accepted encodings are immutable. Reuse only byte-verified variants
// of the same native master and exact delivery format; new masters are encoded.
export function canReuseDogArtworkVariant({ asset, masterSha256, variant, target, expectedUrl, bytes }) {
  return asset?.sourceType === "ai-generated"
    && asset.generator === "OpenAI built-in imagegen"
    && asset.review?.status === "approved"
    && asset.uiDisplayAllowed === true
    && asset.publicSnapshotAllowed === false
    && asset.rasterExportAllowed === false
    && asset.masterSha256 === masterSha256
    && variant?.role === target.role
    && variant.width === target.width
    && variant.height === target.height
    && variant.mime === "image/webp"
    && variant.url === expectedUrl
    && Buffer.isBuffer(bytes)
    && bytes.byteLength === variant.bytes
    && createHash("sha256").update(bytes).digest("hex") === variant.sha256;
}
