import { randomBytes } from "node:crypto";

export const PRODUCTION_PROJECT_REF = "hrfhakrxsllrqmscxxpb";
export const REHEARSAL_CONFIRMATION =
  "I_UNDERSTAND_THIS_TARGETS_ONLY_A_DISPOSABLE_BRANCH";

export const REHEARSAL_ENV = Object.freeze({
  expectedRef: "STACKRANK_SUPABASE_EXPECTED_BRANCH_REF",
  supabaseUrl: "STACKRANK_SUPABASE_BRANCH_URL",
  publishableKey: "STACKRANK_SUPABASE_BRANCH_PUBLISHABLE_KEY",
  secretKey: "STACKRANK_SUPABASE_BRANCH_SECRET_KEY",
  databaseUrl: "STACKRANK_SUPABASE_BRANCH_DB_URL",
  confirmation: "STACKRANK_SUPABASE_REHEARSAL_CONFIRM",
});

export const EXPECTED_MIGRATION_VERSIONS = Object.freeze([
  "20260709001734",
  "20260716090037",
  "20260716090038",
]);

export const EXPECTED_CATEGORY_TABLES = Object.freeze([
  "category_lists",
  "category_pack_progress",
  "category_rankings",
  "category_shared_lists",
]);

export const EXPECTED_CATEGORY_CONSTRAINTS = Object.freeze([
  "category_lists_category_format",
  "category_lists_category_size",
  "category_lists_items_array",
  "category_lists_items_count",
  "category_lists_items_size",
  "category_lists_list_id_format",
  "category_lists_list_type_format",
  "category_lists_list_type_size",
  "category_lists_pkey",
  "category_pack_progress_category_format",
  "category_pack_progress_category_size",
  "category_pack_progress_list_id_format",
  "category_pack_progress_pkey",
  "category_pack_progress_state_object",
  "category_pack_progress_state_size",
  "category_rankings_category_format",
  "category_rankings_category_size",
  "category_rankings_items_array",
  "category_rankings_items_count",
  "category_rankings_items_size",
  "category_rankings_list_id_format",
  "category_rankings_pkey",
  "category_shared_lists_category_format",
  "category_shared_lists_category_size",
  "category_shared_lists_list_id_format",
  "category_shared_lists_owner_category_key",
  "category_shared_lists_payload_catalog_version",
  "category_shared_lists_payload_display_name",
  "category_shared_lists_payload_fields",
  "category_shared_lists_payload_items_array",
  "category_shared_lists_payload_items_count",
  "category_shared_lists_payload_object",
  "category_shared_lists_payload_size",
  "category_shared_lists_pkey",
  "category_shared_lists_slug_format",
]);

const clean = (value) =>
  typeof value === "string" ? value.trim() : "";

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const required = (environment, name) => {
  const value = clean(environment[name]);
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const validRef = (value) => /^[a-z0-9]{20}$/u.test(value);

const parseSupabaseOrigin = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${REHEARSAL_ENV.supabaseUrl} must be a valid URL`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${REHEARSAL_ENV.supabaseUrl} must be a credential-free HTTPS origin`,
    );
  }
  return url;
};

const parseDatabaseUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${REHEARSAL_ENV.databaseUrl} must be a valid URL`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    url.pathname.replace(/^\//u, "") !== "postgres"
  ) {
    throw new Error(
      `${REHEARSAL_ENV.databaseUrl} must be a complete Postgres connection URL`,
    );
  }
  return url;
};

export const parseBranchRehearsalConfig = (environment = process.env) => {
  const expectedRef = required(environment, REHEARSAL_ENV.expectedRef);
  if (!validRef(expectedRef)) {
    throw new Error(`${REHEARSAL_ENV.expectedRef} must be a 20-character project ref`);
  }
  if (expectedRef === PRODUCTION_PROJECT_REF) {
    throw new Error("Production project ref is forbidden for branch rehearsal");
  }
  if (
    required(environment, REHEARSAL_ENV.confirmation) !==
    REHEARSAL_CONFIRMATION
  ) {
    throw new Error(`${REHEARSAL_ENV.confirmation} does not match the required phrase`);
  }

  const supabaseUrl = parseSupabaseOrigin(
    required(environment, REHEARSAL_ENV.supabaseUrl),
  );
  if (supabaseUrl.hostname !== `${expectedRef}.supabase.co`) {
    throw new Error("Branch URL does not match the expected branch ref");
  }
  if (supabaseUrl.href.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("Production Supabase URL is forbidden for branch rehearsal");
  }

  const databaseUrl = parseDatabaseUrl(
    required(environment, REHEARSAL_ENV.databaseUrl),
  );
  const databaseIdentity = `${databaseUrl.hostname} ${safeDecode(
    databaseUrl.username,
  )}`;
  if (databaseIdentity.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("Production database identity is forbidden for branch rehearsal");
  }
  if (!databaseIdentity.includes(expectedRef)) {
    throw new Error("Database URL cannot be proven to belong to the expected branch ref");
  }

  const publishableKey = required(
    environment,
    REHEARSAL_ENV.publishableKey,
  );
  const secretKey = required(environment, REHEARSAL_ENV.secretKey);
  if (publishableKey === secretKey) {
    throw new Error("Publishable and secret keys must be distinct");
  }

  return Object.freeze({
    expectedRef,
    supabaseUrl: supabaseUrl.origin,
    publishableKey,
    secretKey,
    databaseUrl: databaseUrl.href,
  });
};

export const redactSecrets = (value, config) => {
  let result = String(value ?? "");
  const encodedDatabasePassword = (() => {
    try {
      return new URL(config.databaseUrl).password;
    } catch {
      return "";
    }
  })();
  const databasePassword = (() => {
    try {
      return safeDecode(encodedDatabasePassword);
    } catch {
      return "";
    }
  })();
  const secrets = [
    config.publishableKey,
    config.secretKey,
    config.databaseUrl,
    safeDecode(config.databaseUrl),
    encodedDatabasePassword,
    databasePassword,
  ]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  for (const secret of secrets) result = result.split(secret).join("[REDACTED]");
  return result;
};

export const createRehearsalIdentity = () => {
  const runId = randomBytes(8).toString("hex");
  return Object.freeze({
    runId,
    emailA: `stackrank-rehearsal+${runId}-a@example.com`,
    emailB: `stackrank-rehearsal+${runId}-b@example.com`,
    passwordA: `Sr!${randomBytes(18).toString("base64url")}aA1`,
    passwordB: `Sr!${randomBytes(18).toString("base64url")}bB2`,
    slug: runId.slice(0, 12),
    objectPath: `rehearsal/${runId}.webp`,
    deniedObjectPath: `rehearsal/${runId}-denied.webp`,
  });
};

const sameSorted = (actual, expected) =>
  JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());

const policyKey = (policy) =>
  `${policy.table}:${String(policy.command).toUpperCase()}:${(
    policy.roles || []
  ).slice().sort().join(",")}`;

export const validateSchemaProbe = (probe) => {
  if (!probe || typeof probe !== "object") {
    throw new Error("Schema probe did not return an object");
  }
  if (!sameSorted(probe.migrations || [], EXPECTED_MIGRATION_VERSIONS)) {
    throw new Error("Branch migration ledger does not contain the exact three rehearsed versions");
  }
  const tableNames = (probe.tables || []).map((table) => table.name);
  if (!sameSorted(tableNames, EXPECTED_CATEGORY_TABLES)) {
    throw new Error("Branch is missing one or more category tables");
  }
  if ((probe.tables || []).some((table) => table.rls !== true)) {
    throw new Error("RLS is not enabled on every category table");
  }
  const grants = probe.grants || {};
  for (const key of [
    "authenticatedTableCrud",
    "serviceTableCrud",
    "anonSafeColumns",
    "anonOwnershipColumnsDenied",
    "anonPrivateTablesDenied",
    "anonTableWritesDenied",
  ]) {
    if (grants[key] !== true) throw new Error(`Grant probe failed: ${key}`);
  }

  const policies = new Set((probe.policies || []).map(policyKey));
  for (const table of EXPECTED_CATEGORY_TABLES) {
    for (const command of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      if (!policies.has(`${table}:${command}:authenticated`)) {
        throw new Error(`Missing authenticated ${command} policy on ${table}`);
      }
    }
  }
  if (!policies.has("category_shared_lists:SELECT:anon")) {
    throw new Error("Missing anonymous active-snapshot SELECT policy");
  }
  if ((probe.policies || []).length !== 17) {
    throw new Error("Unexpected category policy count");
  }

  if (!sameSorted(probe.constraints || [], EXPECTED_CATEGORY_CONSTRAINTS)) {
    throw new Error("Category constraint set does not match the migration contract");
  }
  const bucket = probe.bucket;
  if (
    bucket?.id !== "dogs-catalog" ||
    bucket?.name !== "dogs-catalog" ||
    bucket?.public !== true ||
    Number(bucket?.fileSizeLimit) !== 5 * 1024 * 1024 ||
    !sameSorted(bucket?.allowedMimeTypes || [], ["image/webp"])
  ) {
    throw new Error("Dogs artwork bucket does not match the bounded public WebP contract");
  }
  if (Number(probe.dogStoragePolicyCount) !== 0) {
    throw new Error("A Dogs-specific storage.objects browser policy was found");
  }
  return true;
};

export const SCHEMA_PROBE_MARKER = "STACKRANK_DOGS_BRANCH_SCHEMA_PROBE:";

const extractMarkedSchemaProbe = (value) => {
  const text = String(value ?? "");
  const markerIndex = text.indexOf(SCHEMA_PROBE_MARKER);
  if (markerIndex < 0) throw new Error("Schema probe marker was not returned");
  const remainder = text.slice(markerIndex + SCHEMA_PROBE_MARKER.length);
  const start = remainder.indexOf("{");
  if (start < 0) throw new Error("Schema probe JSON was not returned");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < remainder.length; index += 1) {
    const char = remainder[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(remainder.slice(start, index + 1));
    }
  }
  throw new Error("Schema probe JSON was incomplete");
};

const findMarkedString = (value) => {
  if (typeof value === "string") {
    return value.includes(SCHEMA_PROBE_MARKER) ? value : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMarkedString(item);
      if (found) return found;
    }
    return "";
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findMarkedString(item);
      if (found) return found;
    }
  }
  return "";
};

export const extractSchemaProbe = (output) => {
  const text = String(output ?? "");
  try {
    const wrapped = JSON.parse(text);
    const marked = findMarkedString(wrapped);
    if (marked) return extractMarkedSchemaProbe(marked);
  } catch (_error) {
    // Plain psql-style output is supported below as a CLI-version fallback.
  }
  return extractMarkedSchemaProbe(text);
};

export const buildSchemaProbeSql = () => `
select '${SCHEMA_PROBE_MARKER}' || jsonb_build_object(
  'migrations', coalesce((
    select jsonb_agg(version order by version)
    from supabase_migrations.schema_migrations
    where version in ('20260709001734', '20260716090037', '20260716090038')
  ), '[]'::jsonb),
  'tables', coalesce((
    select jsonb_agg(
      jsonb_build_object('name', c.relname, 'rls', c.relrowsecurity)
      order by c.relname
    )
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'category_rankings', 'category_lists',
        'category_pack_progress', 'category_shared_lists'
      )
  ), '[]'::jsonb),
  'grants', jsonb_build_object(
    'authenticatedTableCrud', (
      select bool_and(
        has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
      )
      from unnest(array[
        'category_rankings', 'category_lists',
        'category_pack_progress', 'category_shared_lists'
      ]) as tables(table_name)
    ),
    'serviceTableCrud', (
      select bool_and(
        has_table_privilege('service_role', format('public.%I', table_name), 'SELECT')
        and has_table_privilege('service_role', format('public.%I', table_name), 'INSERT')
        and has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE')
        and has_table_privilege('service_role', format('public.%I', table_name), 'DELETE')
      )
      from unnest(array[
        'category_rankings', 'category_lists',
        'category_pack_progress', 'category_shared_lists'
      ]) as tables(table_name)
    ),
    'anonSafeColumns', (
      select bool_and(has_column_privilege('anon', 'public.category_shared_lists', column_name, 'SELECT'))
      from unnest(array['slug', 'category', 'payload', 'created_at', 'updated_at']) as columns(column_name)
    ),
    'anonOwnershipColumnsDenied', (
      not has_column_privilege('anon', 'public.category_shared_lists', 'list_id', 'SELECT')
      and not has_column_privilege('anon', 'public.category_shared_lists', 'revoked_at', 'SELECT')
    ),
    'anonPrivateTablesDenied', (
      select bool_and(
        not has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
        and not has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
        and not has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
        and not has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
      )
      from unnest(array[
        'category_rankings', 'category_lists', 'category_pack_progress'
      ]) as tables(table_name)
    ),
    'anonTableWritesDenied', (
      not has_table_privilege('anon', 'public.category_shared_lists', 'INSERT')
      and not has_table_privilege('anon', 'public.category_shared_lists', 'UPDATE')
      and not has_table_privilege('anon', 'public.category_shared_lists', 'DELETE')
    )
  ),
  'policies', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'table', tablename,
        'command', cmd,
        'roles', to_jsonb(roles)
      ) order by tablename, cmd, policyname
    )
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'category_rankings', 'category_lists',
        'category_pack_progress', 'category_shared_lists'
      )
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(con.conname order by con.conname)
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'category_rankings', 'category_lists',
        'category_pack_progress', 'category_shared_lists'
      )
  ), '[]'::jsonb),
  'bucket', (
    select jsonb_build_object(
      'id', id,
      'name', name,
      'public', public,
      'fileSizeLimit', file_size_limit,
      'allowedMimeTypes', to_jsonb(allowed_mime_types)
    )
    from storage.buckets
    where id = 'dogs-catalog'
  ),
  'dogStoragePolicyCount', (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname ilike '%dog%'
        or coalesce(qual, '') ilike '%dogs-catalog%'
        or coalesce(with_check, '') ilike '%dogs-catalog%'
      )
  )
)::text;
`;
