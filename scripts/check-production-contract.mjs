#!/usr/bin/env node
// Read-only comparison of the deployed site with the local deployment contract.
//
//   node scripts/check-production-contract.mjs [--origin URL] [--full] [--all-excluded]
//                                             [--rate 10] [--concurrency 2]
//
// Every public file must be served with the candidate's bytes (WebPs are
// checked by status/length plus a hashed sample unless --full), excluded paths
// must 404 (every path this contract removed from the old ignore-based output
// plus a per-class sample, or all with --all-excluded), and configured
// cache/MIME headers must apply.
//
// Requests are rate limited. If the host answers with a mitigation challenge
// (x-vercel-mitigated), the run stops as "blocked" instead of retrying: wait
// for the mitigation to expire and rerun at a lower --rate.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compareWithModel, contractDigest, modelIgnoreOutput, planDeployment } from "../deploy/contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const origin = option("--origin", "https://www.stackrankapp.com").replace(/\/$/, "");
const full = args.includes("--full");
const allExcluded = args.includes("--all-excluded");
const concurrency = Number(option("--concurrency", "2"));
const rate = Number(option("--rate", "10"));

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const urlFor = (file) => `${origin}/${file.split("/").map(encodeURIComponent).join("/")}`;

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
};

class MitigationError extends Error {}
let nextSlot = 0;
const throttle = async () => {
  const now = Date.now();
  nextSlot = Math.max(nextSlot, now) + 1000 / rate;
  const delay = nextSlot - 1000 / rate - now;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
};
let blocked = null;
const request = async (url, method = "GET", attempt = 0) => {
  if (blocked) throw new MitigationError(blocked);
  await throttle();
  let response;
  try {
    response = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(30000) });
  } catch (error) {
    if (attempt < 2) return request(url, method, attempt + 1);
    throw error;
  }
  const mitigated = response.headers.get("x-vercel-mitigated");
  if (mitigated) {
    blocked = `${origin} answered ${response.status} with x-vercel-mitigated: ${mitigated} at ${url}`;
    throw new MitigationError(blocked);
  }
  return response;
};

const expectedType = {
  ".html": /^text\/html\b/,
  ".js": /^(?:application|text)\/javascript\b/,
  ".css": /^text\/css\b/,
  ".json": /^application\/json\b/,
  ".webp": /^image\/webp\b/,
  ".png": /^image\/png\b/,
  ".svg": /^image\/svg\+xml\b/,
  ".ico": /^image\/(?:x-icon|vnd\.microsoft\.icon)\b/,
  ".txt": /^text\/plain\b/,
  ".xml": /^(?:application|text)\/xml\b/,
};

const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const cacheRules = vercel.headers
  .filter((rule) => rule.headers.some(({ key }) => key.toLowerCase() === "cache-control"))
  .map((rule) => ({
    regex: new RegExp(`^${rule.source.split("(.*)").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`),
    value: rule.headers.find(({ key }) => key.toLowerCase() === "cache-control").value,
  }));

const plan = planDeployment({ root });
const inventory = plan.inventory;
const isPortrait = (file) => file.startsWith("assets/dogs/generated/");
const portraitSample = new Set(inventory.filter((entry) => isPortrait(entry.path)).filter((_, index) => index % 64 === 0).map((entry) => entry.path));

const startedAt = new Date().toISOString();
const failures = [];
const servedByProduct = {};
const comparison = compareWithModel(root, inventory, modelIgnoreOutput(root, ".vercelignore"), plan.classification);
const removedPaths = new Set(comparison.removed.map((entry) => entry.path));
const perClass = new Map();
const excludedTargets = plan.classification.excluded.filter((entry) => {
  if (allExcluded || removedPaths.has(entry.path)) return true;
  const seen = perClass.get(entry.class) || 0;
  perClass.set(entry.class, seen + 1);
  return seen < 3;
});

const safely = (worker) => async (entry) => {
  try {
    return await worker(entry);
  } catch (error) {
    if (error instanceof MitigationError) return { path: entry.path, status: "blocked" };
    throw error;
  }
};

const files = await mapWithConcurrency(inventory, concurrency, safely(async (entry) => {
  const hashBody = full || !isPortrait(entry.path) || portraitSample.has(entry.path);
  const response = await request(urlFor(entry.path), hashBody ? "GET" : "HEAD");
  const result = { path: entry.path, status: response.status, method: hashBody ? "GET" : "HEAD" };
  if (hashBody) {
    const body = Buffer.from(await response.arrayBuffer());
    result.sha256Match = sha256(body) === entry.sha256 && body.length === entry.bytes;
  } else {
    const length = Number(response.headers.get("content-length"));
    result.lengthMatch = Number.isFinite(length) && length > 0 ? length === entry.bytes : null;
  }
  const type = response.headers.get("content-type") || "";
  const typePattern = expectedType[path.posix.extname(entry.path)];
  result.typeOk = typePattern ? typePattern.test(type) : true;
  const cacheRule = cacheRules.find((rule) => rule.regex.test(`/${entry.path}`));
  result.cacheOk = cacheRule ? response.headers.get("cache-control") === cacheRule.value : true;
  const ok = response.status === 200 && result.sha256Match !== false && result.lengthMatch !== false && result.typeOk && result.cacheOk;
  if (!ok) failures.push({ kind: "public-file", ...result, contentType: type, cacheControl: response.headers.get("cache-control") });
  for (const product of entry.products) {
    servedByProduct[product] ||= { files: 0, ok: 0 };
    servedByProduct[product].files += 1;
    if (ok) servedByProduct[product].ok += 1;
  }
  return result;
}));

const excluded = await mapWithConcurrency(excludedTargets, concurrency, safely(async (entry) => {
  const response = await request(urlFor(entry.path), "HEAD");
  if (response.status !== 404) failures.push({ kind: "excluded-path-served", path: entry.path, status: response.status, class: entry.class });
  return { path: entry.path, status: response.status, removedByContract: removedPaths.has(entry.path) };
}));

const report = {
  status: blocked ? "blocked" : failures.length ? "failed" : "passed",
  blocked,
  origin,
  startedAt,
  completedAt: new Date().toISOString(),
  mode: full ? "full-hash" : "hash-non-portraits-plus-sample",
  contractDigest: contractDigest(inventory),
  totals: {
    publicFiles: files.length,
    hashed: files.filter((entry) => entry.method === "GET").length,
    headChecked: files.filter((entry) => entry.method === "HEAD").length,
    excludedChecked: excluded.filter((entry) => entry.status !== "blocked").length,
    excludedSelected: excludedTargets.length,
    removedByContractChecked: excluded.filter((entry) => entry.removedByContract && entry.status !== "blocked").length,
    blockedRequests: [...files, ...excluded].filter((entry) => entry.status === "blocked").length,
    failures: failures.length,
  },
  servedByProduct,
  removedByContract: excluded.filter((entry) => entry.removedByContract),
  failures,
};
const reportDir = path.join(root, "reports", "deployment-contract", "production");
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, `${startedAt.replace(/\.\d{3}Z$/, "Z").replace(/:/g, "")}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Production contract check against ${origin}: ${report.status}`);
console.log(`  ${report.totals.publicFiles} public files (${report.totals.hashed} hashed, ${report.totals.headChecked} HEAD-checked), ${report.totals.excludedChecked}/${report.totals.excludedSelected} selected excluded paths checked (${report.totals.removedByContractChecked} removed by the contract)`);
if (blocked) console.log(`  BLOCKED ${blocked}; ${report.totals.blockedRequests} requests not made. Wait for the mitigation to expire, then rerun with a lower --rate.`);
for (const [product, totals] of Object.entries(servedByProduct).sort()) console.log(`  ${product}: ${totals.ok}/${totals.files} files match`);
for (const failure of failures.slice(0, 20)) console.log(`  FAIL ${JSON.stringify(failure)}`);
console.log(`  report: ${path.relative(root, reportPath)}`);
if (blocked) process.exitCode = 2;
else if (failures.length) process.exitCode = 1;
