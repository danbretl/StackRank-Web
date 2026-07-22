#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DOG_ARTWORK_UPLOAD_CONFIRMATION =
  "I_UNDERSTAND_THIS_UPLOADS_IMMUTABLE_DOG_ARTWORK";
export const DOG_ARTWORK_BUCKET = "dogs-catalog";
export const DOG_ARTWORK_CACHE_CONTROL = "max-age=31536000";
export const DOG_ARTWORK_SUPABASE_URL =
  "https://hrfhakrxsllrqmscxxpb.supabase.co";
export const DOG_ARTWORK_PUBLIC_BASE_URL =
  `${DOG_ARTWORK_SUPABASE_URL}/storage/v1/object/public/`;

const MAX_VARIANT_BYTES = 5 * 1024 * 1024;
const EXPECTED_VARIANTS = new Map([
  ["card", { width: 320, height: 213 }],
  ["detail", { width: 960, height: 640 }],
]);

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export const resolveDogArtworkOperatorKey = (env = process.env) =>
  cleanString(env.SUPABASE_SECRET_KEY) ||
  cleanString(env.SUPABASE_SERVICE_ROLE_KEY);

const encodedObjectPath = (value) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const normalizeHttpsBaseUrl = (value, label) => {
  let url;
  try {
    url = new URL(cleanString(value));
  } catch {
    throw new Error(`${label} must be an absolute HTTPS URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} must be a credential-free HTTPS URL without query or fragment`,
    );
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
};

const normalizeSupabaseUrl = (value) => {
  const url = normalizeHttpsBaseUrl(value, "SUPABASE_URL");
  if (url.pathname !== "/") {
    throw new Error("SUPABASE_URL must be an origin without a path");
  }
  return url;
};

const normalizeUploadPublicBaseUrl = (publicBaseUrl, supabaseUrl) => {
  const publicBase = normalizeHttpsBaseUrl(
    publicBaseUrl,
    "--public-base-url",
  );
  const supabaseBase = normalizeSupabaseUrl(supabaseUrl);
  if (
    publicBase.origin !== supabaseBase.origin ||
    publicBase.pathname !== "/storage/v1/object/public/" ||
    publicBase.href !== DOG_ARTWORK_PUBLIC_BASE_URL
  ) {
    throw new Error(
      "Upload public base URL must be the configured StackRank Dogs public Storage endpoint",
    );
  }
  return publicBase;
};

const normalizeConfiguredPublicBaseUrl = (publicBaseUrl) => {
  const publicBase = normalizeHttpsBaseUrl(
    publicBaseUrl,
    "--public-base-url",
  );
  if (publicBase.href !== DOG_ARTWORK_PUBLIC_BASE_URL) {
    throw new Error(
      "--public-base-url must be the configured StackRank Dogs public Storage endpoint",
    );
  }
  return publicBase;
};

export const parseDogArtworkDeliveryArgs = (argv) => {
  const options = { upload: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") options.help = true;
    else if (arg === "--upload") options.upload = true;
    else if (
      ["--manifest", "--public-base-url", "--out", "--confirm-upload"].includes(
        arg,
      )
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      options[
        arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      ] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
};

export const validateDogArtworkProcessingManifest = (manifest) => {
  if (manifest?.schemaVersion !== 1) {
    throw new Error("Processing manifest schemaVersion must be 1");
  }
  if (
    !/^dogs:photo:[a-z0-9-]+:[a-f0-9]{16}$/.test(
      cleanString(manifest.assetId),
    )
  ) {
    throw new Error("Processing manifest assetId is invalid");
  }
  if (!/^VBO:\d{7}$/.test(cleanString(manifest.catalogId))) {
    throw new Error("Processing manifest catalogId is invalid");
  }
  const delivery = manifest.delivery;
  if (delivery?.status !== "generated_local") {
    throw new Error(
      "Processing manifest delivery.status must be generated_local",
    );
  }
  const storagePrefix = cleanString(delivery.storagePrefix);
  if (!/^dogs-catalog\/[a-z0-9.-]+\/$/.test(storagePrefix)) {
    throw new Error(
      "Processing manifest storagePrefix is not an immutable Dogs catalog prefix",
    );
  }
  if (!Array.isArray(delivery.variants) || delivery.variants.length !== 2) {
    throw new Error(
      "Processing manifest must contain exactly the card and detail variants",
    );
  }

  const roles = new Set();
  const objectPaths = new Set();
  const variants = delivery.variants.map((variant) => {
    const role = cleanString(variant?.role);
    const expected = EXPECTED_VARIANTS.get(role);
    if (!expected || roles.has(role)) {
      throw new Error(`Processing manifest has an invalid or duplicate role: ${role}`);
    }
    roles.add(role);
    if (
      variant.width !== expected.width ||
      variant.height !== expected.height ||
      variant.mime !== "image/webp"
    ) {
      throw new Error(
        `${role} variant must be ${expected.width}x${expected.height} image/webp`,
      );
    }
    if (
      !Number.isInteger(variant.bytes) ||
      variant.bytes < 1 ||
      variant.bytes > MAX_VARIANT_BYTES
    ) {
      throw new Error(
        `${role} variant byte count is outside the storage bucket limit`,
      );
    }
    if (!/^[a-f0-9]{64}$/.test(cleanString(variant.sha256))) {
      throw new Error(`${role} variant SHA-256 is invalid`);
    }
    const objectPath = cleanString(variant.objectPath);
    if (
      !objectPath.startsWith(storagePrefix) ||
      !/^dogs-catalog\/[a-z0-9.-]+\/[a-z0-9-]+-(?:320|960)\.webp$/.test(
        objectPath,
      ) ||
      objectPaths.has(objectPath)
    ) {
      throw new Error(`${role} variant objectPath is invalid or duplicated`);
    }
    objectPaths.add(objectPath);
    const localPath = cleanString(variant.localPath);
    if (
      !localPath ||
      path.basename(localPath) !== path.basename(objectPath)
    ) {
      throw new Error(
        `${role} variant localPath must name the exact immutable object`,
      );
    }
    return {
      role,
      width: variant.width,
      height: variant.height,
      mime: variant.mime,
      bytes: variant.bytes,
      sha256: variant.sha256,
      objectPath,
      localPath,
    };
  });

  for (const role of EXPECTED_VARIANTS.keys()) {
    if (!roles.has(role)) throw new Error(`Processing manifest is missing ${role}`);
  }

  return {
    schemaVersion: 1,
    assetId: manifest.assetId,
    catalogId: manifest.catalogId,
    storagePrefix,
    variants,
  };
};

const resolveLocalPath = (localPath, rootDirectory) =>
  path.isAbsolute(localPath)
    ? path.resolve(localPath)
    : path.resolve(rootDirectory, localPath);

export const verifyLocalDogArtwork = async ({
  manifest,
  rootDirectory = ROOT,
  readFileImpl = readFile,
}) => {
  const normalized = validateDogArtworkProcessingManifest(manifest);
  const verified = [];
  for (const variant of normalized.variants) {
    const filename = resolveLocalPath(variant.localPath, rootDirectory);
    const bytes = Buffer.from(await readFileImpl(filename));
    if (bytes.byteLength !== variant.bytes) {
      throw new Error(
        `${variant.role} local byte count does not match the processing manifest`,
      );
    }
    if (sha256(bytes) !== variant.sha256) {
      throw new Error(
        `${variant.role} local SHA-256 does not match the processing manifest`,
      );
    }
    verified.push({ ...variant, filename, fileBytes: bytes });
  }
  return { ...normalized, variants: verified };
};

export const buildDogArtworkPublicUrl = (publicBaseUrl, objectPath) => {
  const base = normalizeHttpsBaseUrl(publicBaseUrl, "--public-base-url");
  return new URL(encodedObjectPath(objectPath), base).href;
};

export const buildDogArtworkUploadUrl = ({
  supabaseUrl,
  bucket = DOG_ARTWORK_BUCKET,
  objectPath,
}) => {
  const base = normalizeSupabaseUrl(supabaseUrl);
  const prefix = `${bucket}/`;
  if (!objectPath.startsWith(prefix)) {
    throw new Error(`Object path must begin with ${prefix}`);
  }
  const pathInsideBucket = objectPath.slice(prefix.length);
  return new URL(
    `/storage/v1/object/${encodeURIComponent(bucket)}/${encodedObjectPath(
      pathInsideBucket,
    )}`,
    base,
  ).href;
};

const verifiedCacheControl = (value, role) => {
  const directives = cleanString(value)
    .toLowerCase()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const maxAge = directives
    .map((directive) => /^max-age=(\d+)$/.exec(directive))
    .find(Boolean);
  if (
    !maxAge ||
    Number(maxAge[1]) < 31536000
  ) {
    throw new Error(
      `${role} public object is missing the required one-year cache policy`,
    );
  }
  return cleanString(value);
};

const readExactResponseBytes = async (
  response,
  variant,
  scope = "public",
) => {
  if (!response.body) {
    throw new Error(`${variant.role} ${scope} response has no body`);
  }
  const chunks = [];
  let byteCount = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    byteCount += bytes.byteLength;
    if (
      byteCount > variant.bytes ||
      byteCount > MAX_VARIANT_BYTES
    ) {
      throw new Error(
        `${variant.role} ${scope} byte count does not match the manifest`,
      );
    }
    chunks.push(bytes);
  }
  if (byteCount !== variant.bytes) {
    throw new Error(
      `${variant.role} ${scope} byte count does not match the manifest`,
    );
  }
  return Buffer.concat(chunks, byteCount);
};

export const verifyPublicDogArtworkVariant = async ({
  variant,
  publicBaseUrl,
  fetchImpl = fetch,
}) => {
  const publicUrl = buildDogArtworkPublicUrl(
    publicBaseUrl,
    variant.objectPath,
  );
  const response = await fetchImpl(publicUrl, {
    method: "GET",
    headers: { Accept: "image/webp", "Cache-Control": "no-cache" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `${variant.role} public verification failed with HTTP ${response.status}`,
    );
  }
  const contentType = cleanString(response.headers.get("content-type"))
    .split(";")[0]
    .toLowerCase();
  if (contentType !== variant.mime) {
    throw new Error(
      `${variant.role} public content-type is ${contentType || "missing"}, expected ${variant.mime}`,
    );
  }
  const cacheControl = verifiedCacheControl(
    response.headers.get("cache-control"),
    variant.role,
  );
  const contentLengthHeader = cleanString(
    response.headers.get("content-length"),
  );
  if (
    contentLengthHeader &&
    Number(contentLengthHeader) !== variant.bytes
  ) {
    throw new Error(
      `${variant.role} public content-length does not match the manifest`,
    );
  }
  const bytes = await readExactResponseBytes(response, variant);
  if (sha256(bytes) !== variant.sha256) {
    throw new Error(
      `${variant.role} public SHA-256 does not match the manifest`,
    );
  }
  return {
    role: variant.role,
    objectPath: variant.objectPath,
    publicUrl,
    bytes: bytes.byteLength,
    sha256: variant.sha256,
    contentType,
    cacheControl,
  };
};

export const verifyPublicDogArtwork = async ({
  verifiedLocal,
  publicBaseUrl,
  fetchImpl = fetch,
}) => {
  const remote = [];
  for (const variant of verifiedLocal.variants) {
    remote.push(
      await verifyPublicDogArtworkVariant({
        variant,
        publicBaseUrl,
        fetchImpl,
      }),
    );
  }
  return remote;
};

const preflightImmutablePath = async ({
  variant,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl,
}) => {
  const objectUrl = buildDogArtworkUploadUrl({
    supabaseUrl,
    objectPath: variant.objectPath,
  });
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "image/webp",
    "Cache-Control": "no-cache",
  };
  const response = await fetchImpl(objectUrl, {
    method: "HEAD",
    headers,
    redirect: "error",
  });
  if (response.status === 404) return "missing";
  // Supabase Storage currently maps a missing private object to HTTP 400 at
  // the gateway while preserving the upstream 404 in the JSON response. A
  // HEAD response has no readable body, so confirm that exact shape with GET
  // before treating the immutable path as vacant. Any other 400 still fails
  // closed.
  if (response.status === 400) {
    const missing = await fetchImpl(objectUrl, {
      method: "GET",
      headers,
      redirect: "error",
    });
    if (missing.status === 400) {
      let payload = null;
      try {
        payload = await missing.json();
      } catch {
        // The exact structured not-found response is required below.
      }
      if (
        String(payload?.statusCode || "") === "404" &&
        payload?.error === "not_found" &&
        payload?.message === "Object not found"
      ) {
        return "missing";
      }
    }
    throw new Error(
      `Could not prove immutable path is safe for ${variant.objectPath} (HTTP ${response.status})`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Could not prove immutable path is safe for ${variant.objectPath} (HTTP ${response.status})`,
    );
  }
  const existing = await fetchImpl(objectUrl, {
    method: "GET",
    headers,
    redirect: "error",
  });
  if (!existing.ok) {
    throw new Error(
      `Could not verify existing immutable object ${variant.objectPath} (HTTP ${existing.status})`,
    );
  }
  const contentType = cleanString(existing.headers.get("content-type"))
    .split(";")[0]
    .toLowerCase();
  if (contentType !== variant.mime) {
    throw new Error(
      `Existing immutable object ${variant.objectPath} has the wrong content type`,
    );
  }
  const contentLength = cleanString(existing.headers.get("content-length"));
  if (contentLength && Number(contentLength) !== variant.bytes) {
    throw new Error(
      `Existing immutable object ${variant.objectPath} has the wrong byte count`,
    );
  }
  const bytes = await readExactResponseBytes(
    existing,
    variant,
    "existing immutable object",
  );
  if (sha256(bytes) !== variant.sha256) {
    throw new Error(
      `Existing immutable object ${variant.objectPath} has the wrong SHA-256`,
    );
  }
  return "existing-exact";
};

const uploadImmutableVariant = async ({
  variant,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl,
}) => {
  const uploadUrl = buildDogArtworkUploadUrl({
    supabaseUrl,
    objectPath: variant.objectPath,
  });
  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": variant.mime,
      "Cache-Control": DOG_ARTWORK_CACHE_CONTROL,
    },
    body: variant.fileBytes,
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `${variant.role} immutable upload failed with HTTP ${response.status}`,
    );
  }
};

export const uploadDogArtwork = async ({
  verifiedLocal,
  publicBaseUrl,
  supabaseUrl,
  serviceRoleKey,
  confirmation,
  fetchImpl = fetch,
}) => {
  if (confirmation !== DOG_ARTWORK_UPLOAD_CONFIRMATION) {
    throw new Error(
      `Upload requires --confirm-upload ${DOG_ARTWORK_UPLOAD_CONFIRMATION}`,
    );
  }
  if (!cleanString(supabaseUrl) || !cleanString(serviceRoleKey)) {
    throw new Error(
      "Upload requires SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)",
    );
  }
  const verifiedPublicBase = normalizeUploadPublicBaseUrl(
    publicBaseUrl,
    supabaseUrl,
  ).href;

  // Preflight every path before the first write. An existing exact object is
  // safe to resume after a partial prior run; any mismatch fails closed. The
  // subsequent POST requests deliberately omit x-upsert, so a race also fails
  // instead of replacing.
  const preflight = new Map();
  for (const variant of verifiedLocal.variants) {
    preflight.set(variant.objectPath, await preflightImmutablePath({
      variant,
      supabaseUrl,
      serviceRoleKey,
      fetchImpl,
    }));
  }
  for (const variant of verifiedLocal.variants) {
    if (preflight.get(variant.objectPath) === "existing-exact") continue;
    await uploadImmutableVariant({
      variant,
      supabaseUrl,
      serviceRoleKey,
      fetchImpl,
    });
  }
  return verifyPublicDogArtwork({
    verifiedLocal,
    publicBaseUrl: verifiedPublicBase,
    fetchImpl,
  });
};

const ledgerVariant = (variant) => ({
  role: variant.role,
  width: variant.width,
  height: variant.height,
  mime: variant.mime,
  bytes: variant.bytes,
  sha256: variant.sha256,
  objectPath: variant.objectPath,
});

export const buildDogArtworkDeliveryReport = ({
  verifiedLocal,
  remote = null,
  mode,
  verifiedAt = new Date().toISOString(),
  publicBaseUrl = null,
}) => ({
  schemaVersion: 1,
  kind: "stackrank-dogs-artwork-delivery-verification",
  mode,
  assetId: verifiedLocal.assetId,
  catalogId: verifiedLocal.catalogId,
  verifiedAt,
  local: {
    status: "verified",
    variants: verifiedLocal.variants.map(ledgerVariant),
  },
  remote:
    remote === null
      ? null
      : {
          status: "verified",
          publicAssetBaseUrl:
            normalizeConfiguredPublicBaseUrl(publicBaseUrl).href,
          variants: remote,
        },
  ledgerFragment:
    remote === null
      ? null
      : {
          assetId: verifiedLocal.assetId,
          catalogId: verifiedLocal.catalogId,
          delivery: {
            status: "uploaded_verified",
            variants: verifiedLocal.variants.map(ledgerVariant),
          },
        },
  ledgerMutationPerformed: false,
});

export const runDogArtworkDelivery = async ({
  manifestPath,
  upload = false,
  confirmation = "",
  publicBaseUrl = "",
  supabaseUrl = "",
  serviceRoleKey = "",
  fetchImpl = fetch,
  readFileImpl = readFile,
  rootDirectory = ROOT,
  verifiedAt = new Date().toISOString(),
}) => {
  let manifest;
  try {
    manifest = JSON.parse(await readFileImpl(path.resolve(manifestPath), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Processing manifest is not valid JSON");
    }
    throw error;
  }
  const verifiedLocal = await verifyLocalDogArtwork({
    manifest,
    rootDirectory,
    readFileImpl,
  });

  if (upload) {
    if (confirmation !== DOG_ARTWORK_UPLOAD_CONFIRMATION) {
      throw new Error(
        `Upload requires --confirm-upload ${DOG_ARTWORK_UPLOAD_CONFIRMATION}`,
      );
    }
    if (!cleanString(supabaseUrl) || !cleanString(serviceRoleKey)) {
      throw new Error(
        "Upload requires SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)",
      );
    }
    const effectivePublicBaseUrl =
      cleanString(publicBaseUrl) ||
      new URL("/storage/v1/object/public/", normalizeSupabaseUrl(supabaseUrl))
        .href;
    const remote = await uploadDogArtwork({
      verifiedLocal,
      publicBaseUrl: effectivePublicBaseUrl,
      supabaseUrl,
      serviceRoleKey,
      confirmation,
      fetchImpl,
    });
    return buildDogArtworkDeliveryReport({
      verifiedLocal,
      remote,
      mode: "upload-and-verify",
      verifiedAt,
      publicBaseUrl: effectivePublicBaseUrl,
    });
  }

  if (cleanString(publicBaseUrl)) {
    const verifiedPublicBaseUrl =
      normalizeConfiguredPublicBaseUrl(publicBaseUrl).href;
    const remote = await verifyPublicDogArtwork({
      verifiedLocal,
      publicBaseUrl: verifiedPublicBaseUrl,
      fetchImpl,
    });
    return buildDogArtworkDeliveryReport({
      verifiedLocal,
      remote,
      mode: "remote-read-only",
      verifiedAt,
      publicBaseUrl: verifiedPublicBaseUrl,
    });
  }

  return buildDogArtworkDeliveryReport({
    verifiedLocal,
    mode: "local-read-only",
    verifiedAt,
  });
};

const printHelp = () => {
  console.log(`Verify or immutably deliver processed StackRank Dogs artwork.

Default (local, read-only):
  npm run deliver:dogs:artwork -- --manifest /tmp/example.artwork-processing.json

Remote verification (read-only):
  npm run deliver:dogs:artwork -- \\
    --manifest /tmp/example.artwork-processing.json \\
    --public-base-url ${DOG_ARTWORK_PUBLIC_BASE_URL}

Explicit upload and post-upload verification:
  SUPABASE_URL=https://PROJECT.supabase.co \\
  SUPABASE_SECRET_KEY=... \\
  npm run deliver:dogs:artwork -- \\
    --manifest /tmp/example.artwork-processing.json \\
    --upload \\
    --confirm-upload ${DOG_ARTWORK_UPLOAD_CONFIRMATION} \\
    --out /tmp/example.artwork-delivery.json

Upload first verifies both local files and preflights every authenticated Storage path. It
resumes only when an existing object matches the exact expected bytes, never sends x-upsert,
never overwrites an output report, and never reads or
mutates data/dogs/image-rights.json. The emitted ledgerFragment is operator
input for a separate reviewed ledger edit; it does not grant any use purpose.
`);
};

const main = async () => {
  const options = parseDogArtworkDeliveryArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.manifest) throw new Error("--manifest is required");
  const report = await runDogArtworkDelivery({
    manifestPath: options.manifest,
    upload: options.upload,
    confirmation: options.confirmUpload,
    publicBaseUrl: options.publicBaseUrl,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: resolveDogArtworkOperatorKey(process.env),
  });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    await writeFile(path.resolve(options.out), serialized, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(`Wrote Dogs artwork delivery report to ${path.resolve(options.out)}`);
  } else {
    console.log(serialized);
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`Dogs artwork delivery failed: ${error.message}`);
    process.exitCode = 1;
  });
}
