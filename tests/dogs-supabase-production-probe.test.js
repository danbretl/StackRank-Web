import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  PRODUCTION_PROBE_CONFIRMATION,
  PRODUCTION_PROBE_ENV,
  parseProductionPostApplyConfig,
} from "../scripts/supabase-dogs-production-probe-lib.mjs";
import { PRODUCTION_PROJECT_REF } from "../scripts/supabase-dogs-branch-rehearsal-lib.mjs";

const productionOrigin = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const env = (overrides = {}) => ({
  [PRODUCTION_PROBE_ENV.projectRef]: PRODUCTION_PROJECT_REF,
  [PRODUCTION_PROBE_ENV.supabaseUrl]: productionOrigin,
  [PRODUCTION_PROBE_ENV.publishableKey]: "sb_publishable_production_test",
  [PRODUCTION_PROBE_ENV.secretKey]: "sb_secret_production_test",
  [PRODUCTION_PROBE_ENV.confirmation]: PRODUCTION_PROBE_CONFIRMATION,
  ...overrides,
});

test("production post-apply config requires the exact project and confirmation", () => {
  const config = parseProductionPostApplyConfig(env());
  assert.equal(config.expectedRef, PRODUCTION_PROJECT_REF);
  assert.equal(config.supabaseUrl, productionOrigin);
  assert.notEqual(config.publishableKey, config.secretKey);
});

test("production post-apply config rejects every target ambiguity", () => {
  assert.throws(
    () => parseProductionPostApplyConfig(env({
      [PRODUCTION_PROBE_ENV.projectRef]: "abcdefghijklmnopqrst",
    })),
    /must identify Stack Rank production/u,
  );
  assert.throws(
    () => parseProductionPostApplyConfig(env({
      [PRODUCTION_PROBE_ENV.supabaseUrl]:
        "https://abcdefghijklmnopqrst.supabase.co",
    })),
    /exact credential-free Stack Rank production origin/u,
  );
  assert.throws(
    () => parseProductionPostApplyConfig(env({
      [PRODUCTION_PROBE_ENV.supabaseUrl]: `${productionOrigin}/rest/v1`,
    })),
    /exact credential-free Stack Rank production origin/u,
  );
  assert.throws(
    () => parseProductionPostApplyConfig(env({
      [PRODUCTION_PROBE_ENV.confirmation]: "yes",
    })),
    /required production phrase/u,
  );
  assert.throws(
    () => parseProductionPostApplyConfig(env({
      [PRODUCTION_PROBE_ENV.secretKey]: "sb_publishable_production_test",
    })),
    /must be distinct/u,
  );
});

test("production runner reuses the cleanup-guarded data-plane probe only", async () => {
  const runner = await readFile(
    new URL("../scripts/probe-dogs-supabase-production.mjs", import.meta.url),
    "utf8",
  );
  const shared = await readFile(
    new URL("../scripts/rehearse-dogs-supabase-branch.mjs", import.meta.url),
    "utf8",
  );
  assert.match(runner, /runDogsDataPlaneProbe/u);
  assert.match(runner, /verifySchemaFirst:\s*false/u);
  assert.match(runner, /runAdvisorsAfter:\s*false/u);
  assert.doesNotMatch(runner, /applyMigration|db\s+push|storage\/v1\/object\/dogs-catalog\/vbo-/u);
  assert.match(shared, /finally\s*\{/u);
  assert.match(shared, /serviceCleanupRows/u);
  assert.match(shared, /serviceDeleteObjects/u);
  assert.match(shared, /deleteUser/u);
});
