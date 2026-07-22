import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  DOG_ARTWORK_CACHE_CONTROL,
  DOG_ARTWORK_PUBLIC_BASE_URL,
  DOG_ARTWORK_SUPABASE_URL,
  DOG_ARTWORK_UPLOAD_CONFIRMATION,
  buildDogArtworkPublicUrl,
  buildDogArtworkUploadUrl,
  parseDogArtworkDeliveryArgs,
  runDogArtworkDelivery,
  verifyLocalDogArtwork,
  verifyPublicDogArtworkVariant,
} from "../scripts/deliver-dog-artwork.mjs";

const ROOT = "/virtual/stackrank";
const MANIFEST_PATH = `${ROOT}/processed/artwork-processing.json`;
const ASSET_STEM = "dogs-photo-commons-aaaaaaaaaaaaaaaa";
const cardBytes = Buffer.from("verified card webp fixture");
const detailBytes = Buffer.from("verified detail webp fixture");
const hash = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const processingManifest = () => ({
  schemaVersion: 1,
  assetId: "dogs:photo:commons:aaaaaaaaaaaaaaaa",
  catalogId: "VBO:0000661",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Example.jpg",
  sourceSha256: "a".repeat(64),
  processedAt: "2026-07-17T12:00:00.000Z",
  crop: { x: 0, y: 0, width: 1200, height: 800 },
  modifications: ["crop", "orientation normalization", "resize", "webp conversion"],
  tool: { name: "ImageMagick", version: "fixture", quality: 82, webpMethod: 6 },
  delivery: {
    status: "generated_local",
    storagePrefix: "dogs-catalog/vbo-2026-04-15-r1/",
    variants: [
      {
        role: "card",
        width: 320,
        height: 213,
        mime: "image/webp",
        bytes: cardBytes.byteLength,
        sha256: hash(cardBytes),
        objectPath:
          `dogs-catalog/vbo-2026-04-15-r1/${ASSET_STEM}-320.webp`,
        localPath: `processed/${ASSET_STEM}-320.webp`,
      },
      {
        role: "detail",
        width: 960,
        height: 640,
        mime: "image/webp",
        bytes: detailBytes.byteLength,
        sha256: hash(detailBytes),
        objectPath:
          `dogs-catalog/vbo-2026-04-15-r1/${ASSET_STEM}-960.webp`,
        localPath: `processed/${ASSET_STEM}-960.webp`,
      },
    ],
  },
});

const mockedFiles = (manifest = processingManifest(), overrides = new Map()) => {
  const files = new Map([
    [MANIFEST_PATH, JSON.stringify(manifest)],
    [`${ROOT}/processed/${ASSET_STEM}-320.webp`, cardBytes],
    [`${ROOT}/processed/${ASSET_STEM}-960.webp`, detailBytes],
    ...overrides,
  ]);
  return async (filename, encoding) => {
    if (!files.has(filename)) {
      const error = new Error(`Missing mocked file ${filename}`);
      error.code = "ENOENT";
      throw error;
    }
    const value = files.get(filename);
    return encoding ? String(value) : value;
  };
};

const publicHeaders = (bytes, overrides = {}) => ({
  "content-type": "image/webp",
  "content-length": String(bytes.byteLength),
  "cache-control": DOG_ARTWORK_CACHE_CONTROL,
  ...overrides,
});

const bytesForUrl = (url) =>
  url.endsWith("-320.webp") ? cardBytes : detailBytes;

test("delivery CLI defaults to a read-only local verification mode", async () => {
  assert.deepEqual(
    parseDogArtworkDeliveryArgs(["--manifest", MANIFEST_PATH]),
    { upload: false, manifest: MANIFEST_PATH },
  );
  let fetchCalled = false;
  const report = await runDogArtworkDelivery({
    manifestPath: MANIFEST_PATH,
    readFileImpl: mockedFiles(),
    rootDirectory: ROOT,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("Unexpected network access");
    },
    verifiedAt: "2026-07-17T13:00:00.000Z",
  });
  assert.equal(fetchCalled, false);
  assert.equal(report.mode, "local-read-only");
  assert.equal(report.local.status, "verified");
  assert.equal(report.remote, null);
  assert.equal(report.ledgerFragment, null);
  assert.equal(report.ledgerMutationPerformed, false);
});

test("local verification rejects changed bytes before any delivery action", async () => {
  const manifest = processingManifest();
  const verified = await verifyLocalDogArtwork({
    manifest,
    rootDirectory: ROOT,
    readFileImpl: mockedFiles(manifest),
  });
  assert.equal(verified.variants[0].sha256, hash(cardBytes));

  await assert.rejects(
    verifyLocalDogArtwork({
      manifest,
      rootDirectory: ROOT,
      readFileImpl: mockedFiles(
        manifest,
        new Map([
          [`${ROOT}/processed/${ASSET_STEM}-320.webp`, Buffer.from("tampered")],
        ]),
      ),
    }),
    /local byte count does not match|local SHA-256 does not match/,
  );
});

test("public verification checks exact bytes, MIME, and one-year cache headers", async () => {
  const manifest = processingManifest();
  const variant = manifest.delivery.variants[0];
  const publicBaseUrl =
    "https://project.supabase.co/storage/v1/object/public/";
  const verified = await verifyPublicDogArtworkVariant({
    variant,
    publicBaseUrl,
    fetchImpl: async (url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(
        url,
        buildDogArtworkPublicUrl(publicBaseUrl, variant.objectPath),
      );
      return new Response(cardBytes, {
        status: 200,
        headers: publicHeaders(cardBytes),
      });
    },
  });
  assert.equal(verified.sha256, variant.sha256);
  assert.equal(verified.contentType, "image/webp");
  assert.equal(verified.cacheControl, DOG_ARTWORK_CACHE_CONTROL);

  await assert.rejects(
    verifyPublicDogArtworkVariant({
      variant,
      publicBaseUrl,
      fetchImpl: async () =>
        new Response(cardBytes, {
          status: 200,
          headers: publicHeaders(cardBytes, {
            "cache-control": "public, max-age=3600",
          }),
        }),
    }),
    /one-year cache policy/,
  );
  await assert.rejects(
    verifyPublicDogArtworkVariant({
      variant,
      publicBaseUrl,
      fetchImpl: async () =>
        new Response(Buffer.from("same-length-wrong-byte!"), {
          status: 200,
          headers: publicHeaders(cardBytes),
        }),
    }),
    /public byte count does not match|public SHA-256 does not match/,
  );
});

test("remote read-only verification is pinned to the configured StackRank object store", async () => {
  let fetchCalls = 0;
  await assert.rejects(
    runDogArtworkDelivery({
      manifestPath: MANIFEST_PATH,
      readFileImpl: mockedFiles(),
      rootDirectory: ROOT,
      publicBaseUrl:
        "https://different-project.supabase.co/storage/v1/object/public/",
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("Unexpected network access");
      },
    }),
    /configured StackRank Dogs public Storage endpoint/,
  );
  assert.equal(fetchCalls, 0);
  assert.match(
    DOG_ARTWORK_PUBLIC_BASE_URL,
    /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/$/,
  );
});

test("upload URL keeps the bucket separate from the immutable object path", () => {
  assert.equal(
    buildDogArtworkUploadUrl({
      supabaseUrl: "https://project.supabase.co",
      objectPath:
        `dogs-catalog/vbo-2026-04-15-r1/${ASSET_STEM}-320.webp`,
    }),
    `https://project.supabase.co/storage/v1/object/dogs-catalog/vbo-2026-04-15-r1/${ASSET_STEM}-320.webp`,
  );
});

test("upload mode requires the exact confirmation and both secret environment values", async () => {
  let fetchCalls = 0;
  const common = {
    manifestPath: MANIFEST_PATH,
    readFileImpl: mockedFiles(),
    rootDirectory: ROOT,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("Unexpected network access");
    },
    upload: true,
  };
  await assert.rejects(
    runDogArtworkDelivery(common),
    new RegExp(DOG_ARTWORK_UPLOAD_CONFIRMATION),
  );
  await assert.rejects(
    runDogArtworkDelivery({
      ...common,
      confirmation: DOG_ARTWORK_UPLOAD_CONFIRMATION,
    }),
    /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
  );
  assert.equal(fetchCalls, 0);
});

test("upload mode cannot preflight or verify against another origin", async () => {
  let fetchCalls = 0;
  await assert.rejects(
    runDogArtworkDelivery({
      manifestPath: MANIFEST_PATH,
      readFileImpl: mockedFiles(),
      rootDirectory: ROOT,
      upload: true,
      confirmation: DOG_ARTWORK_UPLOAD_CONFIRMATION,
      publicBaseUrl:
        "https://different-project.supabase.co/storage/v1/object/public/",
      supabaseUrl: DOG_ARTWORK_SUPABASE_URL,
      serviceRoleKey: "fixture-service-role-secret",
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error("Unexpected network access");
      },
    }),
    /configured StackRank Dogs public Storage endpoint/,
  );
  assert.equal(fetchCalls, 0);
});

test("upload mode refuses an existing object whose bytes do not match", async () => {
  const calls = [];
  const wrongBytes = Buffer.alloc(cardBytes.byteLength);
  await assert.rejects(
    runDogArtworkDelivery({
      manifestPath: MANIFEST_PATH,
      readFileImpl: mockedFiles(),
      rootDirectory: ROOT,
      upload: true,
      confirmation: DOG_ARTWORK_UPLOAD_CONFIRMATION,
      supabaseUrl: DOG_ARTWORK_SUPABASE_URL,
      serviceRoleKey: "fixture-service-role-secret",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (options.method === "HEAD") {
          return new Response(null, { status: 200 });
        }
        return new Response(wrongBytes, {
          status: 200,
          headers: publicHeaders(wrongBytes),
        });
      },
    }),
    /Existing immutable object .* wrong SHA-256/,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, "HEAD");
  assert.equal(calls[1].options.method, "GET");
  assert.equal(calls.some(({ options }) => options.method === "POST"), false);
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer fixture-service-role-secret",
  );
  assert.equal(
    calls[0].url,
    `${DOG_ARTWORK_SUPABASE_URL}/storage/v1/object/dogs-catalog/vbo-2026-04-15-r1/${ASSET_STEM}-320.webp`,
  );
});

test("upload mode resumes an exact partially completed immutable delivery", async () => {
  const serviceRoleKey = "fixture-service-role-secret";
  const calls = [];
  const cardObjectPath = processingManifest().delivery.variants[0].objectPath;
  const report = await runDogArtworkDelivery({
    manifestPath: MANIFEST_PATH,
    readFileImpl: mockedFiles(),
    rootDirectory: ROOT,
    upload: true,
    confirmation: DOG_ARTWORK_UPLOAD_CONFIRMATION,
    supabaseUrl: DOG_ARTWORK_SUPABASE_URL,
    serviceRoleKey,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const authenticatedObject =
        url.includes("/storage/v1/object/dogs-catalog/");
      if (options.method === "HEAD") {
        return new Response(null, {
          status: url.endsWith("-320.webp") ? 200 : 404,
        });
      }
      if (options.method === "GET" && authenticatedObject) {
        assert.ok(url.endsWith("-320.webp"));
        return new Response(cardBytes, {
          status: 200,
          headers: publicHeaders(cardBytes),
        });
      }
      if (options.method === "POST") {
        assert.ok(url.endsWith("-960.webp"));
        assert.equal(options.headers["x-upsert"], undefined);
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const bytes = bytesForUrl(url);
      return new Response(bytes, {
        status: 200,
        headers: publicHeaders(bytes),
      });
    },
  });

  assert.deepEqual(
    calls.map(({ options }) => options.method),
    ["HEAD", "GET", "HEAD", "POST", "GET", "GET"],
  );
  assert.equal(
    calls.filter(({ options }) => options.method === "POST").length,
    1,
  );
  assert.equal(
    report.ledgerFragment.delivery.variants[0].objectPath,
    cardObjectPath,
  );
  assert.equal(report.remote.status, "verified");
});

test("explicit upload omits upsert, verifies public bytes, and emits a secret-free ledger fragment", async () => {
  const serviceRoleKey = "fixture-service-role-secret";
  const calls = [];
  const report = await runDogArtworkDelivery({
    manifestPath: MANIFEST_PATH,
    readFileImpl: mockedFiles(),
    rootDirectory: ROOT,
    upload: true,
    confirmation: DOG_ARTWORK_UPLOAD_CONFIRMATION,
    supabaseUrl: DOG_ARTWORK_SUPABASE_URL,
    serviceRoleKey,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "HEAD") {
        return new Response(null, { status: 404 });
      }
      if (options.method === "POST") {
        assert.equal(options.headers.apikey, serviceRoleKey);
        assert.equal(
          options.headers.Authorization,
          `Bearer ${serviceRoleKey}`,
        );
        assert.equal(options.headers["x-upsert"], undefined);
        assert.equal(
          options.headers["Cache-Control"],
          DOG_ARTWORK_CACHE_CONTROL,
        );
        assert.ok(
          options.body.equals(bytesForUrl(url)),
          "uploaded bytes must be the locally verified bytes",
        );
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const bytes = bytesForUrl(url);
      return new Response(bytes, {
        status: 200,
        headers: publicHeaders(bytes),
      });
    },
    verifiedAt: "2026-07-17T13:00:00.000Z",
  });

  assert.deepEqual(
    calls.map(({ options }) => options.method),
    ["HEAD", "HEAD", "POST", "POST", "GET", "GET"],
  );
  assert.equal(report.mode, "upload-and-verify");
  assert.equal(report.remote.status, "verified");
  assert.equal(report.ledgerFragment.delivery.status, "uploaded_verified");
  assert.equal(report.ledgerFragment.delivery.variants.length, 2);
  assert.equal(report.ledgerMutationPerformed, false);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(serviceRoleKey));
});
