#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildSchemaProbeSql,
  createRehearsalIdentity,
  extractSchemaProbe,
  parseBranchRehearsalConfig,
  redactSecrets,
  validateSchemaProbe,
} from "./supabase-dogs-branch-rehearsal-lib.mjs";

const WEBP_FIXTURE = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJQBOgCHwAP7+4QAA",
  "base64",
);
const WEBP_SHA256 = createHash("sha256").update(WEBP_FIXTURE).digest("hex");

const log = (message) => process.stdout.write(`${message}\n`);

const responseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const request = async ({
  config,
  path,
  method = "GET",
  token = config.publishableKey,
  apiKey = config.publishableKey,
  body,
  headers = {},
}) => {
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && !Buffer.isBuffer(body)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body:
      body === undefined || Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body),
    redirect: "error",
  });
  return { response, body: await responseBody(response) };
};

const requireOk = ({ response, body }, label) => {
  if (!response.ok) {
    const code =
      body && typeof body === "object" && typeof body.code === "string"
        ? ` (${body.code})`
        : "";
    throw new Error(`${label} failed with HTTP ${response.status}${code}`);
  }
  return body;
};

const requireDenied = ({ response }, label) => {
  if (response.ok) throw new Error(`${label} unexpectedly succeeded`);
};

const restPath = (table, query = "") =>
  `/rest/v1/${table}${query ? `?${query}` : ""}`;
const eq = (value) => `eq.${encodeURIComponent(value)}`;

const ownerHeaders = {
  Prefer: "return=representation",
};

const createUser = async (config, email, password) => {
  const result = await request({
    config,
    path: "/auth/v1/admin/users",
    method: "POST",
    token: config.secretKey,
    apiKey: config.secretKey,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { stackrank_rehearsal: true },
    },
  });
  const user = requireOk(result, "Disposable Auth user creation");
  assert.match(user?.id || "", /^[0-9a-f-]{36}$/u);
  return user;
};

const signIn = async (config, email, password) => {
  const result = await request({
    config,
    path: "/auth/v1/token?grant_type=password",
    method: "POST",
    body: { email, password },
  });
  const session = requireOk(result, "Disposable Auth user sign-in");
  assert.equal(session?.user?.email, email);
  assert.ok(session?.access_token);
  return session;
};

const deleteUser = async (config, userId) => {
  if (!userId) return;
  const result = await request({
    config,
    path: `/auth/v1/admin/users/${encodeURIComponent(userId)}?should_soft_delete=false`,
    method: "DELETE",
    token: config.secretKey,
    apiKey: config.secretKey,
  });
  if (!result.response.ok && result.response.status !== 404) {
    throw new Error(`Disposable Auth user cleanup failed with HTTP ${result.response.status}`);
  }
};

const runSupabase = (config, args, label, { printOutput = false } = {}) => {
  const result = spawnSync("supabase", args, {
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = redactSecrets(result.stdout || "", config);
  const stderr = redactSecrets(result.stderr || "", config);
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${stderr || stdout}`.trim());
  }
  if (printOutput) {
    if (stdout.trim()) log(stdout.trim());
    if (stderr.trim()) log(stderr.trim());
  }
  return stdout;
};

const verifySchema = (config) => {
  const output = runSupabase(
    config,
    [
      "db",
      "query",
      "--db-url",
      config.databaseUrl,
      buildSchemaProbeSql(),
    ],
    "Branch schema probe",
  );
  validateSchemaProbe(extractSchemaProbe(output));
};

const api = async (config, token, table, query, options = {}) =>
  request({
    config,
    path: restPath(table, query),
    token,
    ...options,
  });

const exactOwnerQuery = (listId, category, select = "*") =>
  `list_id=${eq(listId)}&category=${eq(category)}&select=${encodeURIComponent(select)}`;

const verifyOwnerAndIsolation = async ({ config, sessionA, sessionB, identity }) => {
  const tokenA = sessionA.access_token;
  const tokenB = sessionB.access_token;
  const listA = `user:${sessionA.user.id}`;
  const listB = `user:${sessionB.user.id}`;
  const dogItemA = {
    entityRef: { provider: "vbo", id: "VBO:0200010" },
    snapshot: { name: "Akita" },
  };
  const dogItemUpdated = {
    entityRef: { provider: "vbo", id: "VBO:0201171" },
    snapshot: { name: "Saluki" },
  };
  const bookItem = {
    entityRef: { provider: "openlibrary", id: "/works/OL45883W" },
    snapshot: { title: "A Wizard of Earthsea" },
  };

  requireOk(
    await api(config, tokenA, "category_rankings", "", {
      method: "POST",
      headers: ownerHeaders,
      body: [
        { list_id: listA, category: "dogs", items: [dogItemA] },
        { list_id: listA, category: "books", items: [bookItem] },
      ],
    }),
    "User A ranking insert",
  );
  requireOk(
    await api(config, tokenA, "category_lists", "", {
      method: "POST",
      headers: ownerHeaders,
      body: {
        list_id: listA,
        category: "dogs",
        list_type: "curious",
        items: [dogItemA],
      },
    }),
    "User A list insert",
  );
  requireOk(
    await api(config, tokenA, "category_pack_progress", "", {
      method: "POST",
      headers: ownerHeaders,
      body: {
        list_id: listA,
        category: "dogs",
        state: { starter: { ranked: 1 } },
      },
    }),
    "User A pack-progress insert",
  );
  requireOk(
    await api(config, tokenA, "category_shared_lists", "", {
      method: "POST",
      headers: ownerHeaders,
      body: {
        slug: identity.slug,
        list_id: listA,
        category: "dogs",
        payload: {
          displayName: "Branch rehearsal",
          items: [dogItemA],
          catalogVersion: "rehearsal",
        },
      },
    }),
    "User A shared-list insert",
  );

  const dogUpdate = requireOk(
    await api(
      config,
      tokenA,
      "category_rankings",
      `list_id=${eq(listA)}&category=${eq("dogs")}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: { items: [dogItemUpdated], updated_at: new Date().toISOString() },
      },
    ),
    "User A ranking update",
  );
  assert.equal(dogUpdate.length, 1);
  const listUpdate = requireOk(
    await api(
      config,
      tokenA,
      "category_lists",
      `list_id=${eq(listA)}&category=${eq("dogs")}&list_type=${eq("curious")}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: { items: [dogItemUpdated], updated_at: new Date().toISOString() },
      },
    ),
    "User A list update",
  );
  assert.equal(listUpdate.length, 1);
  const progressUpdate = requireOk(
    await api(
      config,
      tokenA,
      "category_pack_progress",
      `list_id=${eq(listA)}&category=${eq("dogs")}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: { state: { starter: { ranked: 2 } } },
      },
    ),
    "User A pack-progress update",
  );
  assert.equal(progressUpdate.length, 1);
  const sharedUpdate = requireOk(
    await api(
      config,
      tokenA,
      "category_shared_lists",
      `slug=${eq(identity.slug)}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: {
          payload: {
            displayName: "Branch rehearsal updated",
            items: [dogItemUpdated],
            catalogVersion: "rehearsal",
          },
          updated_at: new Date().toISOString(),
        },
      },
    ),
    "User A shared-list update",
  );
  assert.equal(sharedUpdate.length, 1);

  const dogs = requireOk(
    await api(
      config,
      tokenA,
      "category_rankings",
      exactOwnerQuery(listA, "dogs", "category,items"),
    ),
    "User A Dogs read",
  );
  const books = requireOk(
    await api(
      config,
      tokenA,
      "category_rankings",
      exactOwnerQuery(listA, "books", "category,items"),
    ),
    "User A Books read",
  );
  assert.deepEqual(dogs.map((row) => row.category), ["dogs"]);
  assert.deepEqual(books.map((row) => row.category), ["books"]);
  assert.equal(dogs[0].items[0].snapshot.name, "Saluki");
  assert.equal(books[0].items[0].snapshot.title, "A Wizard of Earthsea");

  for (const table of [
    "category_rankings",
    "category_lists",
    "category_pack_progress",
    "category_shared_lists",
  ]) {
    const rows = requireOk(
      await api(config, tokenB, table, `list_id=${eq(listA)}&select=*`),
      `User B isolated read from ${table}`,
    );
    assert.deepEqual(rows, []);
  }

  requireDenied(
    await api(config, tokenB, "category_rankings", "", {
      method: "POST",
      headers: ownerHeaders,
      body: { list_id: listA, category: "cats", items: [] },
    }),
    "User B cross-owner insert",
  );
  const deniedUpdate = requireOk(
    await api(
      config,
      tokenB,
      "category_rankings",
      `list_id=${eq(listA)}&category=${eq("dogs")}`,
      { method: "PATCH", headers: ownerHeaders, body: { items: [] } },
    ),
    "User B cross-owner update request",
  );
  assert.deepEqual(deniedUpdate, []);
  const deniedDelete = requireOk(
    await api(
      config,
      tokenB,
      "category_rankings",
      `list_id=${eq(listA)}&category=${eq("dogs")}`,
      { method: "DELETE", headers: ownerHeaders },
    ),
    "User B cross-owner delete request",
  );
  assert.deepEqual(deniedDelete, []);

  requireOk(
    await api(config, tokenB, "category_rankings", "", {
      method: "POST",
      headers: ownerHeaders,
      body: { list_id: listB, category: "dogs", items: [] },
    }),
    "User B own ranking insert",
  );
  const bRowsVisibleToA = requireOk(
    await api(
      config,
      tokenA,
      "category_rankings",
      `list_id=${eq(listB)}&select=*`,
    ),
    "User A isolated read from User B",
  );
  assert.deepEqual(bRowsVisibleToA, []);

  return { listA, listB, tokenA, dogItemUpdated };
};

const verifyPublicSnapshot = async ({
  config,
  tokenA,
  listA,
  identity,
}) => {
  const active = requireOk(
    await api(
      config,
      config.publishableKey,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&select=${encodeURIComponent(
        "slug,category,payload,created_at,updated_at",
      )}`,
    ),
    "Anonymous active snapshot read",
  );
  assert.equal(active.length, 1);
  assert.equal(active[0].slug, identity.slug);
  assert.equal(active[0].category, "dogs");
  assert.equal(active[0].payload.displayName, "Branch rehearsal updated");

  requireDenied(
    await api(
      config,
      config.publishableKey,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&select=list_id`,
    ),
    "Anonymous ownership-column read",
  );
  requireDenied(
    await api(
      config,
      config.publishableKey,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&select=revoked_at`,
    ),
    "Anonymous revocation-column read",
  );

  const revoked = requireOk(
    await api(
      config,
      tokenA,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&list_id=${eq(listA)}`,
      {
        method: "PATCH",
        headers: ownerHeaders,
        body: { revoked_at: new Date().toISOString() },
      },
    ),
    "Owner snapshot revocation",
  );
  assert.equal(revoked.length, 1);
  const afterRevocation = requireOk(
    await api(
      config,
      config.publishableKey,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&select=${encodeURIComponent("slug,category,payload")}`,
    ),
    "Anonymous revoked snapshot read",
  );
  assert.deepEqual(afterRevocation, []);
  const ownerStillSeesRevoked = requireOk(
    await api(
      config,
      tokenA,
      "category_shared_lists",
      `slug=${eq(identity.slug)}&select=slug,revoked_at`,
    ),
    "Owner revoked snapshot read",
  );
  assert.equal(ownerStillSeesRevoked.length, 1);
  assert.ok(ownerStillSeesRevoked[0].revoked_at);
};

const objectPathUrl = (objectPath) =>
  objectPath.split("/").map(encodeURIComponent).join("/");

const serviceDeleteObjects = async (config, paths) => {
  if (!paths.length) return;
  const result = await request({
    config,
    path: "/storage/v1/object/dogs-catalog",
    method: "DELETE",
    token: config.secretKey,
    apiKey: config.secretKey,
    body: { prefixes: paths },
  });
  if (!result.response.ok && result.response.status !== 404) {
    throw new Error(`Storage fixture cleanup failed with HTTP ${result.response.status}`);
  }
};

const verifyStorage = async ({ config, sessionA, identity, cleanupObjects }) => {
  cleanupObjects.add(identity.objectPath);
  cleanupObjects.add(identity.deniedObjectPath);
  const upload = await request({
    config,
    path: `/storage/v1/object/dogs-catalog/${objectPathUrl(identity.objectPath)}`,
    method: "POST",
    token: config.secretKey,
    apiKey: config.secretKey,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "max-age=31536000",
      "x-upsert": "false",
    },
    body: WEBP_FIXTURE,
  });
  requireOk(upload, "Service-role storage fixture upload");

  const publicResponse = await fetch(
    `${config.supabaseUrl}/storage/v1/object/public/dogs-catalog/${objectPathUrl(
      identity.objectPath,
    )}`,
    { headers: { Accept: "image/webp", "Cache-Control": "no-cache" } },
  );
  assert.equal(publicResponse.status, 200);
  assert.equal(
    (publicResponse.headers.get("content-type") || "").split(";")[0],
    "image/webp",
  );
  const cacheControl = publicResponse.headers.get("cache-control") || "";
  const maxAge = /(?:^|,)\s*max-age=(\d+)/iu.exec(cacheControl);
  assert.ok(maxAge && Number(maxAge[1]) >= 31_536_000);
  const publicBytes = Buffer.from(await publicResponse.arrayBuffer());
  assert.equal(
    createHash("sha256").update(publicBytes).digest("hex"),
    WEBP_SHA256,
  );

  for (const [label, token] of [
    ["anonymous", config.publishableKey],
    ["authenticated", sessionA.access_token],
  ]) {
    const listing = await request({
      config,
      path: "/storage/v1/object/list/dogs-catalog",
      method: "POST",
      token,
      body: { prefix: "rehearsal", limit: 100, offset: 0 },
    });
    if (listing.response.ok) {
      assert.ok(Array.isArray(listing.body));
      assert.deepEqual(
        listing.body,
        [],
        `${label} storage listing disclosed bucket contents`,
      );
    }
  }

  for (const [label, token] of [
    ["anonymous", config.publishableKey],
    ["authenticated", sessionA.access_token],
  ]) {
    requireDenied(
      await request({
        config,
        path: `/storage/v1/object/dogs-catalog/${objectPathUrl(
          identity.deniedObjectPath,
        )}`,
        method: "POST",
        token,
        headers: {
          "Content-Type": "image/webp",
          "x-upsert": "false",
        },
        body: WEBP_FIXTURE,
      }),
      `${label} storage upload`,
    );
  }

  requireDenied(
    await request({
      config,
      path: `/storage/v1/object/dogs-catalog/${objectPathUrl(identity.objectPath)}`,
      method: "POST",
      token: sessionA.access_token,
      headers: {
        "Content-Type": "image/webp",
        "x-upsert": "true",
      },
      body: WEBP_FIXTURE,
    }),
    "Authenticated storage overwrite",
  );
  const deniedDelete = await request({
      config,
      path: "/storage/v1/object/dogs-catalog",
      method: "DELETE",
      token: sessionA.access_token,
      body: { prefixes: [identity.objectPath] },
    });
  if (deniedDelete.response.ok) {
    assert.deepEqual(
      deniedDelete.body,
      [],
      "Authenticated storage delete returned a visible mutation",
    );
  }
  const afterDeniedDelete = await fetch(
    `${config.supabaseUrl}/storage/v1/object/public/dogs-catalog/${objectPathUrl(
      identity.objectPath,
    )}`,
    { headers: { Accept: "image/webp", "Cache-Control": "no-cache" } },
  );
  assert.equal(afterDeniedDelete.status, 200);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await afterDeniedDelete.arrayBuffer()))
      .digest("hex"),
    WEBP_SHA256,
  );
};

const deleteRows = async (
  config,
  token,
  listId,
  identity,
  expectedCounts,
) => {
  const deletions = [
    ["category_shared_lists", `slug=${eq(identity.slug)}`],
    ["category_lists", `list_id=${eq(listId)}`],
    ["category_pack_progress", `list_id=${eq(listId)}`],
    ["category_rankings", `list_id=${eq(listId)}`],
  ];
  for (const [table, query] of deletions) {
    const result = await api(config, token, table, query, {
      method: "DELETE",
      headers: ownerHeaders,
    });
    const deleted = requireOk(result, `Owner row cleanup for ${table}`);
    assert.equal(
      deleted.length,
      expectedCounts[table] || 0,
      `Owner DELETE count mismatch for ${table}`,
    );
  }
};

const serviceCleanupRows = async (config, listIds, identity) => {
  if (!listIds.length) return;
  const targets = [
    ["category_shared_lists", `slug=${eq(identity.slug)}`],
    ...listIds.flatMap((listId) => [
      ["category_lists", `list_id=${eq(listId)}`],
      ["category_pack_progress", `list_id=${eq(listId)}`],
      ["category_rankings", `list_id=${eq(listId)}`],
    ]),
  ];
  for (const [table, query] of targets) {
    const result = await api(config, config.secretKey, table, query, {
      apiKey: config.secretKey,
      method: "DELETE",
      headers: ownerHeaders,
    });
    if (!result.response.ok && result.response.status !== 404) {
      throw new Error(`Service row cleanup failed for ${table}`);
    }
  }
};

const runAdvisors = (config) => {
  for (const type of ["security", "performance"]) {
    log(`\n${type[0].toUpperCase()}${type.slice(1)} advisors:`);
    runSupabase(
      config,
      [
        "db",
        "advisors",
        "--db-url",
        config.databaseUrl,
        "--type",
        type,
        "--level",
        "warn",
        "--fail-on",
        "error",
      ],
      `${type} advisors`,
      { printOutput: true },
    );
  }
};

export const runBranchRehearsal = async (environment = process.env) => {
  const config = parseBranchRehearsalConfig(environment);
  const identity = createRehearsalIdentity();
  const users = [];
  const listIds = new Set();
  const cleanupObjects = new Set();
  let sessionA;
  let sessionB;
  let mainError;

  log(`Rehearsing disposable Supabase branch ${config.expectedRef}.`);
  log("Secrets and database credentials will not be printed.");
  try {
    log("1/6 Verifying migration ledger, schema, grants, RLS, constraints, and bucket...");
    verifySchema(config);

    log("2/6 Creating two confirmed disposable Auth users...");
    users.push(await createUser(config, identity.emailA, identity.passwordA));
    users.push(await createUser(config, identity.emailB, identity.passwordB));
    sessionA = await signIn(config, identity.emailA, identity.passwordA);
    sessionB = await signIn(config, identity.emailB, identity.passwordB);
    listIds.add(`user:${sessionA.user.id}`);
    listIds.add(`user:${sessionB.user.id}`);

    log("3/6 Exercising owner CRUD, two-user RLS, and Dogs/Books isolation...");
    const ownerState = await verifyOwnerAndIsolation({
      config,
      sessionA,
      sessionB,
      identity,
    });

    log("4/6 Exercising anonymous safe-column reads and revocation...");
    await verifyPublicSnapshot({ config, identity, ...ownerState });

    log("5/6 Exercising known-object public GET and browser list/write denial...");
    await verifyStorage({ config, sessionA, identity, cleanupObjects });

    log("6/6 Proving owner DELETE before service-level cleanup fallback...");
    await deleteRows(config, sessionA.access_token, ownerState.listA, identity, {
      category_shared_lists: 1,
      category_lists: 1,
      category_pack_progress: 1,
      category_rankings: 2,
    });
    await deleteRows(config, sessionB.access_token, ownerState.listB, identity, {
      category_rankings: 1,
    });

    runAdvisors(config);
    log("\nDisposable branch rehearsal passed.");
  } catch (error) {
    mainError = error;
  } finally {
    const cleanupErrors = [];
    try {
      await serviceCleanupRows(config, [...listIds], identity);
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await serviceDeleteObjects(config, [...cleanupObjects]);
    } catch (error) {
      cleanupErrors.push(error);
    }
    for (const user of users.reverse()) {
      try {
        await deleteUser(config, user.id);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length) {
      const summary = cleanupErrors.map((error) => error.message).join("; ");
      mainError = new Error(
        `${mainError ? `${mainError.message}; ` : ""}Cleanup incomplete: ${summary}`,
      );
    } else {
      log("Cleanup verified: fixture rows, objects, and Auth users removed.");
    }
  }
  if (mainError) throw mainError;
};

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runBranchRehearsal().catch((error) => {
    process.stderr.write(`Rehearsal failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
