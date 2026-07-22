import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPECTED_CATEGORY_CONSTRAINTS,
  EXPECTED_CATEGORY_TABLES,
  EXPECTED_MIGRATION_VERSIONS,
  PRODUCTION_PROJECT_REF,
  REHEARSAL_CONFIRMATION,
  SCHEMA_PROBE_MARKER,
  buildSchemaProbeSql,
  extractSchemaProbe,
  parseBranchRehearsalConfig,
  redactSecrets,
  validateSchemaProbe,
} from "../scripts/supabase-dogs-branch-rehearsal-lib.mjs";

const BRANCH_REF = "abcdefghijklmnopqrst";
const env = (overrides = {}) => ({
  STACKRANK_SUPABASE_EXPECTED_BRANCH_REF: BRANCH_REF,
  STACKRANK_SUPABASE_BRANCH_URL: `https://${BRANCH_REF}.supabase.co`,
  STACKRANK_SUPABASE_BRANCH_PUBLISHABLE_KEY: "sb_publishable_branch_test",
  STACKRANK_SUPABASE_BRANCH_SECRET_KEY: "sb_secret_branch_test",
  STACKRANK_SUPABASE_BRANCH_DB_URL:
    `postgresql://postgres.${BRANCH_REF}:branch-password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  STACKRANK_SUPABASE_REHEARSAL_CONFIRM: REHEARSAL_CONFIRMATION,
  ...overrides,
});

const validProbe = () => ({
  migrations: [...EXPECTED_MIGRATION_VERSIONS],
  tables: EXPECTED_CATEGORY_TABLES.map((name) => ({ name, rls: true })),
  grants: {
    authenticatedTableCrud: true,
    serviceTableCrud: true,
    anonSafeColumns: true,
    anonOwnershipColumnsDenied: true,
    anonPrivateTablesDenied: true,
    anonTableWritesDenied: true,
  },
  policies: [
    ...EXPECTED_CATEGORY_TABLES.flatMap((table) =>
      ["SELECT", "INSERT", "UPDATE", "DELETE"].map((command) => ({
        table,
        command,
        roles: ["authenticated"],
      })),
    ),
    {
      table: "category_shared_lists",
      command: "SELECT",
      roles: ["anon"],
    },
  ],
  constraints: [...EXPECTED_CATEGORY_CONSTRAINTS],
  bucket: {
    id: "dogs-catalog",
    name: "dogs-catalog",
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  },
  dogStoragePolicyCount: 0,
});

test("branch rehearsal config accepts an exact disposable branch identity", () => {
  const config = parseBranchRehearsalConfig(env());
  assert.equal(config.expectedRef, BRANCH_REF);
  assert.equal(config.supabaseUrl, `https://${BRANCH_REF}.supabase.co`);
  assert.match(config.databaseUrl, /sslmode=require/u);
});

test("branch rehearsal config rejects the production ref on every boundary", () => {
  assert.throws(
    () =>
      parseBranchRehearsalConfig(
        env({
          STACKRANK_SUPABASE_EXPECTED_BRANCH_REF: PRODUCTION_PROJECT_REF,
          STACKRANK_SUPABASE_BRANCH_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
          STACKRANK_SUPABASE_BRANCH_DB_URL:
            `postgresql://postgres.${PRODUCTION_PROJECT_REF}:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
        }),
      ),
    /Production project ref is forbidden/u,
  );
  assert.throws(
    () =>
      parseBranchRehearsalConfig(
        env({
          STACKRANK_SUPABASE_BRANCH_DB_URL:
            `postgresql://postgres.${PRODUCTION_PROJECT_REF}:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
        }),
      ),
    /Production database identity is forbidden/u,
  );
});

test("branch rehearsal config rejects URL/ref mismatches and missing confirmation", () => {
  assert.throws(
    () =>
      parseBranchRehearsalConfig(
        env({
          STACKRANK_SUPABASE_BRANCH_URL:
            "https://zyxwvutsrqponmlkjihg.supabase.co",
        }),
      ),
    /does not match/u,
  );
  assert.throws(
    () =>
      parseBranchRehearsalConfig(
        env({ STACKRANK_SUPABASE_REHEARSAL_CONFIRM: "yes" }),
      ),
    /required phrase/u,
  );
  assert.throws(
    () =>
      parseBranchRehearsalConfig(
        env({
          STACKRANK_SUPABASE_BRANCH_DB_URL:
            "postgresql://postgres.unrelatedref0000000:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres",
        }),
      ),
    /cannot be proven/u,
  );
});

test("secret redaction removes keys, database URL, and decoded database password", () => {
  const config = parseBranchRehearsalConfig(env({
    STACKRANK_SUPABASE_BRANCH_DB_URL:
      `postgresql://postgres.${BRANCH_REF}:branch%2Fpassword@aws-0-us-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  }));
  const output = redactSecrets(
    `${config.publishableKey} ${config.secretKey} ${config.databaseUrl} branch%2Fpassword branch/password`,
    config,
  );
  assert.doesNotMatch(output, /sb_publishable|sb_secret|branch%2Fpassword|branch\/password/u);
  assert.match(output, /\[REDACTED\]/u);
});

test("schema probe validator accepts only the exact migration/RLS/grant contract", () => {
  assert.equal(validateSchemaProbe(validProbe()), true);
  const withoutRls = validProbe();
  withoutRls.tables[0].rls = false;
  assert.throws(() => validateSchemaProbe(withoutRls), /RLS is not enabled/u);
  const broadStorage = validProbe();
  broadStorage.dogStoragePolicyCount = 1;
  assert.throws(
    () => validateSchemaProbe(broadStorage),
    /storage\.objects browser policy/u,
  );
  const missingMigration = validProbe();
  missingMigration.migrations.pop();
  assert.throws(
    () => validateSchemaProbe(missingMigration),
    /exact three rehearsed versions/u,
  );
});

test("schema probe SQL and parser use a deterministic non-secret marker", () => {
  const sql = buildSchemaProbeSql();
  assert.match(sql, new RegExp(SCHEMA_PROBE_MARKER));
  assert.doesNotMatch(sql, new RegExp(PRODUCTION_PROJECT_REF));
  const probe = validProbe();
  const output = `query output\n ${SCHEMA_PROBE_MARKER}${JSON.stringify(probe)}\n(1 row)`;
  assert.deepEqual(extractSchemaProbe(output), probe);
  const cliEnvelope = JSON.stringify({
    boundary: "fixture",
    rows: [{
      "?column?": `${SCHEMA_PROBE_MARKER}${JSON.stringify(probe)}`,
    }],
  });
  assert.deepEqual(extractSchemaProbe(cliEnvelope), probe);
});
