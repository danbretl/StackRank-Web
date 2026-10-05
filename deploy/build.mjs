#!/usr/bin/env node
// Build or check the staged StackRank deployment.
//
//   node deploy/build.mjs                 build dist/public plus dist/contract reports
//   node deploy/build.mjs --check         two clean builds in temporary directories,
//                                         determinism + source-preservation checks,
//                                         evidence under reports/deployment-contract/
//
// Options: --build-dir <dir> (default dist), --inputs auto|git|filesystem,
// --report-dir <dir> (with --check), --compare-ignore <file> (default .vercelignore).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILD_MARKER,
  ContractError,
  PUBLIC_DIR_NAME,
  REPORT_DIR_NAME,
  buildDeployment,
  sha256Hex,
  stableJson,
  verifyOutput,
} from "./contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const parseArgs = (argv) => {
  const options = { buildDir: "dist", inputs: "auto", check: false, reportDir: null, compareIgnore: ".vercelignore" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      index += 1;
      return next;
    };
    if (arg === "--check") options.check = true;
    else if (arg === "--build-dir") options.buildDir = value();
    else if (arg === "--inputs") options.inputs = value();
    else if (arg === "--report-dir") options.reportDir = value();
    else if (arg === "--compare-ignore") options.compareIgnore = value();
    else throw new Error(`Unknown option ${arg}`);
  }
  return options;
};

const formatBytes = (bytes) => `${bytes.toLocaleString("en-US")} B (${(bytes / 1024 / 1024).toFixed(1)} MiB)`;

const printSummary = (result, label) => {
  const summary = result.reports["summary.json"];
  console.log(`${label}: ${summary.totals.files} public files, ${formatBytes(summary.totals.bytes)}; digest ${summary.contractDigest}`);
  console.log(`  inputs: ${summary.inputMode} (${result.plan.inputs.reason}); classification ${summary.classification.status} (${summary.classification.included} included, ${summary.classification.excluded} excluded, ${summary.classification.unclassified} unclassified)`);
  for (const [product, totals] of Object.entries(summary.byProduct)) {
    console.log(`  ${product}: ${totals.files} files, ${formatBytes(totals.bytes)}`);
  }
  for (const family of summary.families) console.log(`  family ${family.id}: ${family.files} files`);
  const comparison = result.reports["current-ignore-comparison.json"];
  if (comparison) {
    const { model, contract, removed, added } = comparison.totals;
    console.log(`  vs modeled ignore-based output: ${model.files} → ${contract.files} files (${removed.files} removed, ${added.files} added), ${formatBytes(model.bytes)} → ${formatBytes(contract.bytes)}`);
  }
  console.log(`  output: ${path.relative(root, result.publicDir) || result.publicDir}`);
};

const gitStatus = () => {
  try {
    return execFileSync("git", ["-C", root, "status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "utf8" });
  } catch {
    return null;
  }
};

const treeDigest = (dir) => {
  const lines = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(dir, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) walk(absolute);
      else lines.push(`${relative}\t${sha256Hex(fs.readFileSync(absolute))}`);
    }
  };
  walk(dir);
  return { files: lines.length, sha256: sha256Hex(lines.join("\n")) };
};

const readReports = (reportDir) =>
  Object.fromEntries(fs.readdirSync(reportDir).sort().map((name) => [name, fs.readFileSync(path.join(reportDir, name), "utf8")]));

const runCheck = (options) => {
  const startedAt = new Date().toISOString();
  const timestamp = startedAt.replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");
  const reportsRoot = path.join(root, "reports", "deployment-contract");
  const reportDir = options.reportDir ? path.resolve(options.reportDir) : path.join(reportsRoot, "runs", timestamp);
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "stackrank-deploy-check-"));
  const statusBefore = gitStatus();
  const results = [];
  try {
    for (const label of ["build-a", "build-b"]) {
      const result = buildDeployment({ root, buildDir: path.join(scratch, label), inputMode: options.inputs, compareIgnoreFile: options.compareIgnore });
      printSummary(result, label);
      results.push(result);
    }
    const [first, second] = results;
    const firstReports = readReports(first.reportDir);
    const secondReports = readReports(second.reportDir);
    const reportDiffs = Object.keys({ ...firstReports, ...secondReports }).filter((name) => firstReports[name] !== secondReports[name]);
    const firstTree = treeDigest(first.publicDir);
    const secondTree = treeDigest(second.publicDir);
    const reverify = verifyOutput(second.publicDir, first.plan.inventory);
    const statusAfter = gitStatus();
    const sourceDigestBefore = first.reports["summary.json"].contractDigest;
    const sourceDigestAfter = second.reports["summary.json"].contractDigest;
    const checks = {
      identicalReports: reportDiffs.length === 0,
      identicalOutputTrees: firstTree.sha256 === secondTree.sha256 && firstTree.files === secondTree.files,
      outputMatchesInventory: reverify.length === 0,
      sourceStatusUnchanged: statusBefore === statusAfter,
      publicInputsUnchanged: sourceDigestBefore === sourceDigestAfter,
    };
    fs.mkdirSync(reportDir, { recursive: true });
    for (const [name, text] of Object.entries(firstReports)) fs.writeFileSync(path.join(reportDir, name), text);
    const evidence = {
      status: Object.values(checks).every(Boolean) ? "passed" : "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      gitHead: (() => {
        try {
          return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        } catch {
          return null;
        }
      })(),
      checks,
      reportDiffs,
      outputTrees: { first: firstTree, second: secondTree },
      gitStatusEntriesBefore: statusBefore === null ? null : statusBefore.split("\0").filter(Boolean).length,
    };
    fs.writeFileSync(path.join(reportDir, "check-evidence.json"), stableJson(evidence));
    if (!options.reportDir) {
      const latest = path.join(reportsRoot, "latest");
      fs.rmSync(latest, { force: true, recursive: true });
      try {
        fs.symlinkSync(path.relative(reportsRoot, reportDir), latest, "dir");
      } catch {
        fs.writeFileSync(path.join(reportsRoot, "latest.txt"), `${path.relative(root, reportDir)}\n`);
      }
    }
    for (const [name, passed] of Object.entries(checks)) console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
    console.log(`Deployment contract evidence: ${path.relative(root, reportDir)}`);
    if (evidence.status !== "passed") process.exitCode = 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.check) {
    runCheck(options);
    return;
  }
  const startedAt = new Date().toISOString();
  const result = buildDeployment({ root, buildDir: options.buildDir, inputMode: options.inputs, compareIgnoreFile: options.compareIgnore });
  fs.writeFileSync(
    path.join(result.buildDir, "build-info.json"),
    stableJson({
      note: "Volatile build metadata; deterministic reports are in contract/.",
      startedAt,
      completedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      vercelCommit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      publicDir: PUBLIC_DIR_NAME,
      reportDir: REPORT_DIR_NAME,
      marker: BUILD_MARKER,
    }),
  );
  printSummary(result, "Deployment build");
};

try {
  main();
} catch (error) {
  if (error instanceof ContractError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
