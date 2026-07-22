#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { runDogsDataPlaneProbe } from "./rehearse-dogs-supabase-branch.mjs";
import { parseProductionPostApplyConfig } from "./supabase-dogs-production-probe-lib.mjs";

export const runProductionPostApplyProbe = async (environment = process.env) => {
  const config = parseProductionPostApplyConfig(environment);
  return runDogsDataPlaneProbe(config, {
    verifySchemaFirst: false,
    runAdvisorsAfter: false,
    targetLabel: `Stack Rank production ${config.expectedRef}`,
    successMessage: "Bounded production Dogs data-plane probe passed.",
  });
};

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runProductionPostApplyProbe().catch((error) => {
    process.stderr.write(`Production post-apply probe failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
