import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { summarizePortraitCohortF, validatePortraitCohortF } from "./dog-portrait-cohort-f.mjs";

import { summarizePortraitCohortG, validatePortraitCohortG } from "./dog-portrait-cohort-g.mjs";

import { summarizePortraitCohortH, validatePortraitCohortH } from "./dog-portrait-cohort-h.mjs";
import { summarizePortraitCohortI, validatePortraitCohortI } from "./dog-portrait-cohort-i.mjs";

const root = new URL("../", import.meta.url);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const sha256 = (value) => /^[a-f0-9]{64}$/.test(value || "");
const allowed = (value, values) => values.includes(value);

// Progress fields are deliberately excluded. Identity/order/source evidence may never drift
// when the discovery queue shrinks after a successful integration.
export function portraitCohortSelectionDigest(cohort) {
  return digest({
    cohortId: cohort.cohortId,
    frozenAt: cohort.frozenAt,
    baseline: cohort.baseline,
    selectionPolicy: cohort.selectionPolicy,
    sourceSnapshots: cohort.sourceSnapshots,
    entries: cohort.entries.map((entry) => ({
      ordinal: entry.ordinal,
      catalogId: entry.catalogId,
      displayName: entry.displayName,
      subwave: entry.subwave,
      discoveryPriorityRank: entry.discoveryPriorityRank,
      selection: entry.selection,
    })),
  });
}

export function summarizePortraitCohort(cohort) {
  const entries = cohort.entries;
  const attempts = entries.flatMap((entry) => entry.generation.attempts);
  const next = entries.find((entry) => entry.integration.status !== "integrated") || null;
  const actionable = entries.find((entry) => entry.integration.status !== "integrated" && entry.reference.status !== "blocked" && entry.generation.status !== "blocked") || null;
  return {
    targetCount: entries.length,
    referenceApprovedCount: entries.filter((entry) => entry.reference.status === "approved").length,
    sceneReadyCount: entries.filter((entry) => entry.scene.status === "ready").length,
    attemptedIdentityCount: entries.filter((entry) => entry.generation.attempts.length > 0).length,
    attemptCount: attempts.length,
    completedGenerationCount: attempts.filter((attempt) => attempt.status === "generated").length,
    failedCallCount: attempts.filter((attempt) => attempt.status === "failed").length,
    rejectedMasterCount: attempts.filter((attempt) => attempt.qaDecision === "rejected").length,
    retryCount: entries.reduce((sum, entry) => sum + Math.max(0, entry.generation.attempts.length - 1), 0),
    acceptedCount: entries.filter((entry) => entry.qa.status === "approved").length,
    integratedCount: entries.filter((entry) => entry.integration.status === "integrated").length,
    remainingCount: entries.filter((entry) => entry.integration.status !== "integrated").length,
    blockedCount: entries.filter((entry) => entry.reference.status === "blocked" || entry.generation.status === "blocked").length,
    nextIdentity: next ? { ordinal: next.ordinal, catalogId: next.catalogId, displayName: next.displayName, subwave: next.subwave } : null,
    nextActionableIdentity: actionable ? { ordinal: actionable.ordinal, catalogId: actionable.catalogId, displayName: actionable.displayName, subwave: actionable.subwave } : null,
    subwaves: Array.from({ length: 10 }, (_, index) => {
      const id = `e${String(index + 1).padStart(2, "0")}`;
      const wave = entries.filter((entry) => entry.subwave === id);
      return { id, targetCount: wave.length, acceptedCount: wave.filter((entry) => entry.qa.status === "approved").length, integratedCount: wave.filter((entry) => entry.integration.status === "integrated").length };
    }),
  };
}

export function validatePortraitCohort(cohort, { catalog, rightsLedger, generatedArtwork } = {}) {
  const errors = [];
  const fail = (condition, message) => { if (!condition) errors.push(message); };
  fail(cohort.schemaVersion === 1 && cohort.cohortId === "dogs-portraits-e", "Unknown cohort schema or identity");
  fail(Array.isArray(cohort.entries) && cohort.entries.length === 250, "Cohort must retain exactly 250 entries");
  if (!Array.isArray(cohort.entries)) return errors;
  fail(cohort.selectionSha256 === portraitCohortSelectionDigest(cohort), "Frozen selection digest mismatch; do not change identity, order, or selection evidence");
  fail(cohort.baseline?.packEngagedCount === 161 && cohort.baseline?.longTailSelectedCount === 89, "Frozen selection must retain 161 pack-engaged and 89 long-tail entries");
  fail(cohort.baseline?.illustratedCount === 52 && cohort.baseline?.selectableCount === 1239, "Frozen coverage baseline changed");
  fail(cohort.permissions?.reference?.uiDisplayAllowed === false && cohort.permissions?.reference?.publicSnapshotAllowed === false && cohort.permissions?.reference?.rasterExportAllowed === false, "Reference purposes must all remain denied");
  fail(cohort.permissions?.generated?.uiDisplayAllowed === true && cohort.permissions?.generated?.publicSnapshotAllowed === false && cohort.permissions?.generated?.rasterExportAllowed === false, "Generated permissions must remain UI-only");
  for (const key of ["discoveryQueue", "catalog", "profiles", "packs", "rightsLedger", "generatedArtwork", "artworkLicensePolicy", "generatedArtworkPolicy"]) {
    const source = cohort.sourceSnapshots?.[key];
    fail(nonempty(source?.path) && sha256(source?.sha256), `${key}: source snapshot needs a path and exact SHA-256`);
  }
  const catalogById = new Map((catalog?.entities || []).map((entry) => [entry.id, entry]));
  const rightsById = new Map((rightsLedger?.assets || []).map((entry) => [entry.assetId, entry]));
  const generatedById = new Map((generatedArtwork?.assets || []).map((entry) => [entry.catalogId, entry]));
  const seen = new Set();
  cohort.entries.forEach((entry, index) => {
    const label = `${entry.catalogId || index}`;
    fail(!seen.has(entry.catalogId), `${label}: duplicate identity`);
    seen.add(entry.catalogId);
    fail(entry.ordinal === index + 1 && entry.subwave === `e${String(Math.floor(index / 25) + 1).padStart(2, "0")}`, `${label}: order or subwave changed`);
    fail(entry.selection?.tier === (index < 161 ? "pack-engaged" : "canonical-long-tail"), `${label}: incorrect selection tier`);
    if (index < 161) fail(entry.discoveryPriorityRank === index + 1, `${label}: pack engagement order changed`);
    fail(!cohort.baseline.generatedCatalogIds.includes(entry.catalogId), `${label}: identity was already illustrated at freeze`);
    if (catalog) {
      const entity = catalogById.get(entry.catalogId);
      fail(entity?.selectable === true && ["canonical", "breed"].includes(entity?.status), `${label}: must be a selectable canonical identity`);
      fail(entity?.displayName === entry.displayName, `${label}: catalog name mismatch`);
    }
    fail(allowed(entry.reference?.status, ["pending", "researching", "approved", "blocked"]), `${label}: invalid reference status`);
    fail(allowed(entry.scene?.status, ["pending", "researching", "ready", "blocked"]), `${label}: invalid scene status`);
    fail(allowed(entry.generation?.status, ["pending", "generating", "generated", "retry-needed", "accepted", "blocked"]), `${label}: invalid generation status`);
    fail(allowed(entry.qa?.status, ["pending", "reviewing", "rejected", "approved"]), `${label}: invalid QA status`);
    fail(allowed(entry.integration?.status, ["pending", "ready", "integrated"]), `${label}: invalid integration status`);
    if (entry.reference?.status === "approved") {
      fail(nonempty(entry.reference.assetId) && nonempty(entry.reference.sourcePage) && nonempty(entry.reference.visualReview), `${label}: approved reference requires exact provenance and visual review`);
      if (rightsLedger) {
        const reference = rightsById.get(entry.reference.assetId);
        fail(reference?.catalogId === entry.catalogId, `${label}: exact reference rights row missing`);
        fail(reference?.sourcePage === entry.reference.sourcePage && reference?.review?.status === "approved" && reference?.review?.subjectMatchesCatalog === true && reference?.review?.nonCopyrightRestrictionsReviewed === true, `${label}: reference must match approved source and subject/rights review`);
        fail(reference?.uiDisplayAllowed === false && reference?.publicSnapshotAllowed === false && reference?.rasterExportAllowed === false, `${label}: morphology reference purposes must remain denied`);
      }
    }
    if (entry.scene?.status === "ready") fail(nonempty(entry.scene.description) && nonempty(entry.scene.rationale) && Array.isArray(entry.scene.sources) && entry.scene.sources.length > 0, `${label}: ready scene requires description, rationale and evidence`);
    const attempts = entry.generation?.attempts;
    fail(Array.isArray(attempts), `${label}: attempts must be an append-only array`);
    if (!Array.isArray(attempts)) return;
    const attemptIds = new Set();
    attempts.forEach((attempt, attemptIndex) => {
      fail(attempt.number === attemptIndex + 1 && nonempty(attempt.id) && !attemptIds.has(attempt.id), `${label}: attempts must retain unique sequential ids`);
      attemptIds.add(attempt.id);
      fail(allowed(attempt.status, ["running", "generated", "failed"]) && allowed(attempt.qaDecision, ["pending", "rejected", "accepted"]), `${label}: invalid attempt state`);
      fail(nonempty(attempt.startedAt) && nonempty(attempt.prompt), `${label}: every attempt needs its exact prompt and timestamp`);
      if (attempt.status === "generated") fail(nonempty(attempt.masterPath) && attempt.masterPath.startsWith("assets/dogs/generated-masters/") && sha256(attempt.masterSha256), `${label}: generated attempt needs an ignored master path and exact digest`);
      if (attempt.status === "failed") fail(nonempty(attempt.failure), `${label}: failed call needs its failure evidence`);
      if (attempt.qaDecision === "rejected") fail(nonempty(attempt.rejectionReason), `${label}: rejected master needs an accountable reason`);
      if (attempt.qaDecision === "accepted") fail(attempt.status === "generated" && attempt.id === entry.generation.acceptedAttemptId && entry.qa.status === "approved", `${label}: accepted attempt must match approved QA`);
    });
    if (attempts.length) fail(entry.reference.status === "approved" && entry.scene.status === "ready", `${label}: generation requires reviewed reference and researched scene`);
    if (entry.qa.status === "approved" || entry.generation.status === "accepted" || entry.integration.status === "integrated") {
      const accepted = attempts.find((attempt) => attempt.id === entry.generation.acceptedAttemptId);
      fail(entry.qa.status === "approved" && entry.generation.status === "accepted" && accepted?.status === "generated" && accepted?.qaDecision === "accepted", `${label}: accepted state requires an exact generated and visually accepted attempt`);
      fail(["reviewedAt", "breedIdentity", "anatomy", "crop", "aesthetics"].every((key) => nonempty(entry.qa[key])), `${label}: approved QA requires all four review dimensions and timestamp`);
      fail(attempts.filter((attempt) => attempt.qaDecision === "accepted").length === 1, `${label}: exactly one attempt may be accepted`);
    }
    if (entry.integration.status === "integrated") {
      fail(entry.integration.batchManifest === `data/dogs/generated-artwork-batch-${entry.subwave}.json` && nonempty(entry.integration.assetId) && nonempty(entry.integration.integratedAt), `${label}: integrated entry needs exact batch/asset/time`);
      fail(nonempty(entry.qa.contactSheetPath), `${label}: integrated entry needs its reviewed subwave contact sheet`);
      if (generatedArtwork) {
        const asset = generatedById.get(entry.catalogId);
        const accepted = attempts.find((attempt) => attempt.id === entry.generation.acceptedAttemptId);
        fail(asset?.assetId === entry.integration.assetId && asset?.masterSha256 === accepted?.masterSha256 && asset?.reference?.assetId === entry.reference.assetId, `${label}: integrated manifest does not match accepted master/reference`);
        fail(asset?.uiDisplayAllowed === true && asset?.publicSnapshotAllowed === false && asset?.rasterExportAllowed === false, `${label}: integrated asset purpose gate changed`);
      }
    }
  });
  fail(JSON.stringify(cohort.progress) === JSON.stringify(summarizePortraitCohort(cohort)), "Progress summary is stale; refresh it after recording evidence");
  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Usage: node scripts/dog-portrait-cohort.mjs [--cohort=f|--cohort=g|--cohort=h|--cohort=i] [--check|--refresh-progress]\nDefaults to frozen cohort E. F checks 100 completed pairs; G checks 25; H checks 43; I checks 50. All retain append-only reserves. --refresh-progress refreshes derived counters after evidence changes.");
    return;
  }
  if (args.some((arg) => !["--check", "--refresh-progress", "--cohort=f", "--cohort=g", "--cohort=h", "--cohort=i"].includes(arg))) throw new Error("Unknown option; use --help");
  const isF = args.includes("--cohort=f");
  const isG = args.includes("--cohort=g");
  const isH = args.includes("--cohort=h");
  const isI = args.includes("--cohort=i");
  if ([isF, isG, isH, isI].filter(Boolean).length > 1) throw new Error("Choose one cohort per invocation");
  const path = new URL(`data/dogs/portrait-cohort-${isI ? "i" : isH ? "h" : isG ? "g" : isF ? "f" : "e"}.json`, root);
  const [cohort, catalog, rightsLedger, generatedArtwork, profiles] = await Promise.all([
    path, new URL("data/dogs/dog-catalog.json", root), new URL("data/dogs/image-rights.json", root), new URL("data/dogs/generated-artwork.json", root), new URL("data/dogs/breed-profiles.json", root),
  ].map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  if (args.includes("--refresh-progress")) cohort.progress = (isI ? summarizePortraitCohortI : isH ? summarizePortraitCohortH : isG ? summarizePortraitCohortG : isF ? summarizePortraitCohortF : summarizePortraitCohort)(cohort);
  const runSelection = isG ? JSON.parse(await readFile(new URL("data/dogs/portrait-continuation-100.json", root), "utf8")) : undefined;
  const errors = (isI ? validatePortraitCohortI : isH ? validatePortraitCohortH : isG ? validatePortraitCohortG : isF ? validatePortraitCohortF : validatePortraitCohort)(cohort, { catalog, rightsLedger, generatedArtwork, profiles, runSelection });
  if (errors.length) throw new Error(errors.join("\n"));
  if (args.includes("--refresh-progress")) {
    const temporaryPath = `${fileURLToPath(path)}.tmp-${process.pid}`;
    await writeFile(temporaryPath, `${JSON.stringify(cohort, null, 2)}\n`);
    await rename(temporaryPath, path);
  }
  console.log(JSON.stringify({ cohortId: cohort.cohortId, selectionSha256: cohort.selectionSha256, ...cohort.progress }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
