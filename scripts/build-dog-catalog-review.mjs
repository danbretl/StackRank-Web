#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "reports", "dogs-catalog-review", "index.html");
const SOURCE_PREDICATE = "http://purl.org/dc/terms/source";
const VBO_IRI_PREFIX = "http://purl.obolibrary.org/obo/VBO_";

const QUEUES = Object.freeze([
  { key: "aliasDecisions", label: "Alias decisions", disposition: "alias" },
  { key: "varietyDecisions", label: "Variety decisions", disposition: "variety" },
  { key: "crossbreedDecisions", label: "Crossbreed decisions", disposition: "crossbreed" },
  { key: "historicalDecisions", label: "Historical decisions", disposition: "historical" },
  { key: "excludedDecisions", label: "Excluded decisions", disposition: "excluded" },
  {
    key: "regionalLandraceCandidates",
    label: "Regional / landrace candidates",
    disposition: null,
  },
  {
    key: "ambiguousSearchNames",
    label: "Ambiguous search names",
    disposition: "ambiguous_search_name",
  },
]);

const asArray = (value) => (Array.isArray(value) ? value : []);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const uniqueStrings = (values) => [...new Set(values.map(cleanText).filter(Boolean))];
const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toCurie = (value) => {
  const text = cleanText(value);
  if (/^VBO:\d{7}$/u.test(text)) return text;
  const match = text.match(/\/VBO_(\d{7})$/u);
  return match ? `VBO:${match[1]}` : null;
};

const toVboUrl = (id) =>
  /^VBO:\d{7}$/u.test(id || "") ? `${VBO_IRI_PREFIX}${id.slice(4)}` : "";

const sourceDisplayName = (value) =>
  cleanText(value)
    .replace(/ \(Dog\)$/u, "")
    .trim();

const definitionText = (definition) =>
  cleanText(typeof definition === "object" ? definition?.val : definition);

const parseArgs = (argv) => {
  const args = { out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--out" && argv[index + 1]) {
      args.out = path.resolve(process.cwd(), argv[index + 1]);
      index += 1;
      continue;
    }
    if (argv[index] === "--help" || argv[index] === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
};

function ontologyNodesById(ontology) {
  return new Map(
    asArray(ontology?.graphs?.[0]?.nodes)
      .map((node) => [toCurie(node?.id), node])
      .filter(([id]) => id),
  );
}

function sourceContext(id, { nodesById, termsById }) {
  const node = nodesById.get(id);
  const term = termsById.get(id);
  const parentIds = uniqueStrings(term?.sourceParents || []);
  return {
    id,
    vboUrl: toVboUrl(id),
    label: cleanText(node?.lbl || term?.sourceLabel),
    displayName: sourceDisplayName(node?.lbl || term?.sourceLabel),
    sourceDepth: Number.isInteger(term?.sourceDepth) ? term.sourceDepth : null,
    disposition: cleanText(term?.disposition),
    selectable: term?.selectable === true,
    reasonCode: cleanText(term?.reasonCode),
    targetId: cleanText(term?.targetId),
    parentId: cleanText(term?.parentId),
    parents: parentIds.map((parentId) => ({
      id: parentId,
      label: sourceDisplayName(
        nodesById.get(parentId)?.lbl || termsById.get(parentId)?.sourceLabel || parentId,
      ),
      vboUrl: toVboUrl(parentId),
    })),
    synonyms: uniqueStrings(asArray(node?.meta?.synonyms).map((synonym) => synonym?.val)),
    xrefs: uniqueStrings(asArray(node?.meta?.xrefs).map((xref) => xref?.val)),
    sources: uniqueStrings(
      asArray(node?.meta?.basicPropertyValues)
        .filter((property) => property?.pred === SOURCE_PREDICATE)
        .map((property) => property?.val),
    ),
    comments: uniqueStrings(node?.meta?.comments || []),
    definition: definitionText(node?.meta?.definition),
  };
}

function runtimeContext(id, runtimeById) {
  const entity = runtimeById.get(id);
  if (!entity) return null;
  return {
    id: cleanText(entity.id),
    displayName: cleanText(entity.displayName),
    status: cleanText(entity.status),
    selectable: entity.selectable === true,
    aliases: uniqueStrings(entity.aliases || []),
    sourceIds: uniqueStrings(entity.sourceIds || []),
    registryRefs: uniqueStrings(entity.registryRefs || []),
    relationships: entity.relationships || {},
  };
}

function relevantOverrideContext(ids, overrides) {
  const idSet = new Set(ids);
  const decisions = overrides?.classification?.decisions || {};
  const entities = overrides?.entities || {};
  const classificationDecisions = Object.fromEntries(
    ids.filter((id) => decisions[id]).map((id) => [id, decisions[id]]),
  );
  const entityOverrides = Object.fromEntries(
    ids.filter((id) => entities[id]).map((id) => [id, entities[id]]),
  );
  const searchAliasOwners = Object.fromEntries(
    Object.entries(overrides?.searchAliasOwners || {}).filter(([, id]) => idSet.has(id)),
  );
  const reciprocalAliasExclusions = asArray(
    overrides?.classification?.reciprocalAliasExclusions,
  ).filter((pair) => asArray(pair).some((id) => idSet.has(id)));
  const normalizedDisplayNameExceptions = asArray(
    overrides?.normalizedDisplayNameExceptions,
  ).filter((exception) => {
    const serialized = JSON.stringify(exception);
    return ids.some((id) => serialized.includes(id));
  });
  const hasExplicitContext =
    Object.keys(classificationDecisions).length > 0 ||
    Object.keys(entityOverrides).length > 0 ||
    Object.keys(searchAliasOwners).length > 0 ||
    reciprocalAliasExclusions.length > 0 ||
    normalizedDisplayNameExceptions.length > 0;
  return {
    hasExplicitContext,
    classificationDecisions,
    entityOverrides,
    searchAliasOwners,
    reciprocalAliasExclusions,
    normalizedDisplayNameExceptions,
  };
}

function normalQueueItem(entry, queue, context) {
  const source = sourceContext(entry.vboId, context);
  const relatedIds = uniqueStrings([
    entry.targetId,
    entry.parentId,
    source.targetId,
    source.parentId,
  ]);
  const allIds = uniqueStrings([entry.vboId, ...relatedIds]);
  const relatedSources = relatedIds.map((id) => sourceContext(id, context));
  const runtimeEntities = allIds
    .map((id) => runtimeContext(id, context.runtimeById))
    .filter(Boolean);
  const overrideContext = relevantOverrideContext(allIds, context.overrides);
  const relationId = cleanText(entry.targetId || entry.parentId || source.targetId || source.parentId);
  const relationLabel = sourceDisplayName(
    entry.targetLabel ||
      entry.parentLabel ||
      context.nodesById.get(relationId)?.lbl ||
      context.termsById.get(relationId)?.sourceLabel,
  );
  return {
    reviewKey: `${queue.key}:${entry.vboId}`,
    queue: queue.key,
    queueLabel: queue.label,
    primaryLabel: sourceDisplayName(entry.sourceLabel || source.label),
    primaryId: entry.vboId,
    subjectIds: [entry.vboId],
    currentDisposition: cleanText(entry.disposition || source.disposition || queue.disposition),
    reasonCode: cleanText(entry.reasonCode || source.reasonCode),
    relation: relationId
      ? {
          kind:
            cleanText(entry.targetId || source.targetId) ? "target" : "parent",
          id: relationId,
          label: relationLabel || relationId,
        }
      : null,
    source,
    relatedSources,
    runtimeEntities,
    overrideContext,
    rawQueueEntry: entry,
  };
}

function ambiguousQueueItem(entry, queue, context) {
  const subjectIds = uniqueStrings(entry.entityIds || []);
  const sources = subjectIds.map((id) => sourceContext(id, context));
  const runtimeEntities = subjectIds
    .map((id) => runtimeContext(id, context.runtimeById))
    .filter(Boolean);
  return {
    reviewKey: `${queue.key}:${entry.normalizedName}`,
    queue: queue.key,
    queueLabel: queue.label,
    primaryLabel: cleanText(entry.normalizedName),
    primaryId: "",
    subjectIds,
    currentDisposition: queue.disposition,
    reasonCode: cleanText(entry.reasonCode),
    relation: null,
    source: null,
    relatedSources: sources,
    runtimeEntities,
    overrideContext: relevantOverrideContext(subjectIds, context.overrides),
    rawQueueEntry: entry,
  };
}

export function buildCatalogReviewModel({
  review,
  classification,
  overrides,
  catalog,
  ontology,
} = {}) {
  const terms = asArray(classification?.terms);
  const context = {
    nodesById: ontologyNodesById(ontology),
    termsById: new Map(terms.map((term) => [term.vboId, term])),
    runtimeById: new Map(asArray(catalog?.entities).map((entity) => [entity.id, entity])),
    overrides: overrides || {},
  };
  const items = [];
  const queueCounts = [];
  for (const queue of QUEUES) {
    const entries = asArray(review?.[queue.key]);
    queueCounts.push({ key: queue.key, label: queue.label, count: entries.length });
    for (const entry of entries) {
      items.push(
        queue.key === "ambiguousSearchNames"
          ? ambiguousQueueItem(entry, queue, context)
          : normalQueueItem(entry, queue, context),
      );
    }
  }

  const queueOrder = new Map(QUEUES.map((queue, index) => [queue.key, index]));
  items.sort(
    (left, right) =>
      queueOrder.get(left.queue) - queueOrder.get(right.queue) ||
      left.primaryLabel.localeCompare(right.primaryLabel, "en") ||
      left.reviewKey.localeCompare(right.reviewKey, "en"),
  );
  for (const item of items) {
    item.searchText = uniqueStrings([
      item.primaryLabel,
      item.primaryId,
      item.currentDisposition,
      item.reasonCode,
      item.relation?.id,
      item.relation?.label,
      ...item.subjectIds,
      ...asArray(item.rawQueueEntry?.names),
      ...asArray(item.source?.synonyms),
      ...item.relatedSources.flatMap((source) => [
        source.displayName,
        ...source.synonyms,
      ]),
      ...item.runtimeEntities.flatMap((entity) => [
        entity.displayName,
        ...entity.aliases,
        ...entity.registryRefs,
      ]),
    ])
      .join(" ")
      .toLocaleLowerCase("en");
  }

  const dispositions = uniqueStrings(items.map((item) => item.currentDisposition)).sort();
  const reasonCodes = uniqueStrings(items.map((item) => item.reasonCode)).sort();
  const distinctSubjectIds = new Set(items.flatMap((item) => item.subjectIds));
  return {
    schemaVersion: 1,
    generatedFrom: {
      catalogVersion: cleanText(review?.catalogVersion || catalog?.catalogVersion),
      reviewSchemaVersion: Number(review?.schemaVersion) || null,
      classificationSchemaVersion: Number(classification?.schemaVersion) || null,
      overridesSchemaVersion: Number(overrides?.schemaVersion) || null,
      reviewedAt: cleanText(review?.reviewedAt || classification?.reviewedAt),
      source: review?.source || classification?.source || {},
      paths: {
        review: "data/dogs/classification-review.json",
        classification: "data/dogs/classification.json",
        overrides: "data/dogs/catalog-overrides.json",
        catalog: "data/dogs/dog-catalog.json",
        ontology: "data/dogs/sources/vbo-2026-04-15.json",
      },
    },
    summary: {
      queueItems: items.length,
      distinctSubjectIds: distinctSubjectIds.size,
      explicitOverrideItems: items.filter((item) => item.overrideContext.hasExplicitContext).length,
      queueCounts,
    },
    filters: { dispositions, reasonCodes },
    items,
  };
}

const renderOptions = (values, labelFor = (value) => value) =>
  values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelFor(value))}</option>`)
    .join("");

export function renderCatalogReviewHtml(model) {
  const queueOptions = renderOptions(
    model.summary.queueCounts.map((queue) => queue.key),
    (key) => model.summary.queueCounts.find((queue) => queue.key === key)?.label || key,
  );
  const dispositionOptions = renderOptions(model.filters.dispositions);
  const reasonOptions = renderOptions(model.filters.reasonCodes);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>StackRank Dogs — Catalog review</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f2f2f2;
      --panel: #fff;
      --ink: #111;
      --muted: #666;
      --line: #111;
      --line-soft: #dedede;
      --soft: #f8f8f8;
      --danger: #8a1f1f;
      --radius: 14px;
      font-family: "Space Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); color: var(--ink); }
    body { margin: 0; min-width: 320px; background: var(--bg); }
    button, input, select, textarea { color: inherit; font: inherit; }
    button, select, input[type="search"], input[type="text"], textarea {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
    }
    button, select { min-height: 42px; }
    button { padding: 0 15px; font-size: 14px; font-weight: 700; cursor: pointer; }
    button:hover { background: #ededed; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible,
    summary:focus-visible, a:focus-visible {
      outline: 3px solid #777;
      outline-offset: 2px;
    }
    a { color: inherit; text-underline-offset: 3px; }
    [hidden] { display: none !important; }

    .page-header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: minmax(260px, 1fr) minmax(290px, 1.15fr) auto;
      gap: 24px;
      align-items: center;
      min-height: 104px;
      padding: 20px 28px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, .97);
      backdrop-filter: blur(10px);
    }
    .page-header h1 { margin: 0; font-size: clamp(29px, 3vw, 43px); line-height: .98; letter-spacing: -.045em; }
    .safety {
      min-height: 58px;
      padding-left: 22px;
      border-left: 1px solid var(--line-soft);
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
    }
    .safety strong { font-size: 16px; }
    .safety span { color: var(--muted); font-size: 14px; line-height: 1.35; }
    .export-button { min-width: 184px; border-width: 2px; background: var(--panel); }

    .review-layout {
      display: grid;
      grid-template-columns: 252px minmax(0, 1fr);
      min-height: calc(100vh - 104px);
    }
    .filters {
      padding: 22px 20px 32px;
      border-right: 1px solid var(--line);
      background: #fafafa;
    }
    .filters-inner { position: sticky; top: 126px; }
    .filters-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .filters h2 { margin: 0; font-size: 18px; }
    .clear-button { min-height: 34px; padding: 0; border: 0; background: transparent; font-size: 12px; font-weight: 600; }
    .filter-group { display: grid; gap: 7px; margin-top: 18px; }
    .filter-group label { font-size: 12px; font-weight: 750; }
    .filter-group input, .filter-group select { width: 100%; min-height: 42px; padding: 8px 10px; font-size: 13px; }
    .filter-note { margin: 18px 0 0; padding-top: 16px; border-top: 1px solid var(--line-soft); color: var(--muted); font-size: 12px; line-height: 1.5; }

    .review-main { min-width: 0; background: var(--panel); }
    .review-toolbar {
      position: sticky;
      top: 104px;
      z-index: 8;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 22px;
      align-items: center;
      padding: 16px 28px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, .97);
      backdrop-filter: blur(10px);
    }
    .counts { display: flex; gap: clamp(22px, 5vw, 70px); overflow-x: auto; }
    .count { min-width: max-content; }
    .count span { display: block; color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
    .count strong { display: block; margin-top: 2px; font-size: 22px; line-height: 1; }
    .sort-control { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .sort-control select { min-height: 38px; padding: 6px 28px 6px 9px; color: var(--ink); font-size: 12px; }
    .mobile-filter-toggle { display: none; }

    .results-meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 28px;
      border-bottom: 1px solid var(--line-soft);
      color: var(--muted);
      font-size: 12px;
    }
    .results-meta button { min-height: auto; padding: 0; border: 0; color: var(--danger); background: transparent; font-size: 12px; }
    .review-list { min-width: 0; }
    .review-row { border-bottom: 1px solid var(--line-soft); }
    .review-row[hidden] { display: none; }
    .row-summary {
      display: grid;
      grid-template-columns: minmax(210px, 1.35fr) minmax(145px, .75fr) minmax(175px, .9fr) minmax(130px, .7fr) 28px;
      gap: 18px;
      align-items: center;
      min-height: 86px;
      padding: 13px 28px;
      cursor: pointer;
      list-style: none;
    }
    .row-summary::-webkit-details-marker { display: none; }
    .row-summary:hover { background: var(--soft); }
    details[open] > .row-summary { background: #f7f7f7; border-bottom: 1px solid var(--line); }
    .row-title strong { display: block; font-size: 15px; line-height: 1.25; }
    .row-title span, .row-cell span { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .row-cell strong { display: block; font-size: 12px; line-height: 1.35; }
    .draft-state { color: var(--muted); }
    .draft-state.is-reviewed { color: var(--ink); font-weight: 750; }
    .chevron { justify-self: end; width: 20px; height: 20px; transition: transform 150ms ease; }
    details[open] .chevron { transform: rotate(180deg); }
    .chevron path { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

    .row-body { padding: 24px 28px 30px; background: #fff; }
    .evidence-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border: 1px solid var(--line);
    }
    .evidence-section { min-width: 0; padding: 18px; border-right: 1px solid var(--line-soft); }
    .evidence-section:last-child { border-right: 0; }
    .evidence-section h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .055em; }
    .evidence-section dl { display: grid; gap: 11px; margin: 0; }
    .evidence-section dt { color: var(--muted); font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .05em; }
    .evidence-section dd { margin: 2px 0 0; overflow-wrap: anywhere; font-size: 12px; line-height: 1.45; }
    .evidence-section ul { margin: 3px 0 0; padding-left: 16px; font-size: 12px; line-height: 1.45; }
    .source-links { display: grid; gap: 7px; }
    .source-links a { overflow-wrap: anywhere; font-size: 11px; line-height: 1.4; }
    .code-context { max-height: 210px; margin: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 10.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .empty-context { color: var(--muted); font-size: 12px; line-height: 1.5; }

    .decision-panel {
      display: grid;
      grid-template-columns: minmax(220px, .85fr) minmax(240px, 1fr) minmax(280px, 1.25fr);
      gap: 22px;
      margin-top: 18px;
      padding: 20px;
      border: 2px solid var(--line);
      border-radius: var(--radius);
      background: var(--soft);
    }
    .decision-panel fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
    .decision-panel legend, .field-label { display: block; margin-bottom: 9px; font-size: 12px; font-weight: 800; }
    .decision-options { display: grid; gap: 8px; }
    .decision-options label, .follow-up { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; line-height: 1.35; }
    .decision-options input, .follow-up input { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; accent-color: #111; }
    .proposal-fields { display: grid; gap: 12px; align-content: start; }
    .proposal-fields label, .notes-field { display: grid; gap: 6px; font-size: 11px; font-weight: 700; }
    .proposal-fields select, .proposal-fields input { width: 100%; min-height: 40px; padding: 7px 9px; font-size: 12px; }
    .notes-field textarea { width: 100%; min-height: 100px; resize: vertical; padding: 10px; font-size: 12px; line-height: 1.45; }
    .follow-up { margin-top: 10px; font-weight: 650; }
    .local-state-line { margin: 12px 0 0; color: var(--muted); font-size: 11px; line-height: 1.4; }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      padding: 18px 28px 28px;
      color: var(--muted);
      font-size: 12px;
    }
    .page-actions { display: flex; gap: 8px; }
    .page-actions button { min-width: 78px; }
    .empty-results { padding: 72px 28px; text-align: center; color: var(--muted); }

    @media (max-width: 1080px) {
      .page-header { grid-template-columns: 1fr auto; gap: 14px; min-height: 116px; }
      .safety { grid-column: 1 / -1; grid-row: 2; min-height: auto; padding: 0; border-left: 0; }
      .review-toolbar { top: 116px; grid-template-columns: 1fr; }
      .sort-control { justify-content: flex-end; }
      .evidence-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .evidence-section:nth-child(2) { border-right: 0; }
      .evidence-section:nth-child(-n+2) { border-bottom: 1px solid var(--line-soft); }
      .decision-panel { grid-template-columns: minmax(210px, .85fr) minmax(250px, 1.15fr); }
      .notes-column { grid-column: 1 / -1; }
      .row-summary { grid-template-columns: minmax(200px, 1.3fr) minmax(135px, .8fr) minmax(140px, .85fr) 24px; }
      .row-summary .override-cell { display: none; }
    }

    @media (max-width: 720px) {
      .page-header {
        position: static;
        grid-template-columns: 1fr;
        min-height: 0;
        padding: 20px 18px;
      }
      .page-header h1 { font-size: 34px; }
      .safety { grid-column: auto; grid-row: auto; }
      .export-button { width: 100%; }
      .review-layout { display: flex; flex-direction: column; }
      .filters {
        display: none;
        order: 1;
        border-top: 0;
        border-bottom: 1px solid var(--line);
        border-right: 0;
      }
      .filters.is-open { display: block; }
      .review-main { order: 2; }
      .filters-inner { position: static; }
      .review-toolbar { position: static; padding: 15px 18px; }
      .counts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px 24px;
        width: 100%;
        overflow: visible;
      }
      .sort-control { justify-content: stretch; }
      .sort-control label { flex: 0 0 auto; }
      .sort-control select { width: 100%; }
      .mobile-filter-toggle { display: block; width: 100%; }
      .results-meta, .row-summary, .row-body, .pagination { padding-left: 18px; padding-right: 18px; }
      .row-summary {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px 16px;
        min-height: 92px;
      }
      .row-title { grid-column: 1; }
      .row-summary .disposition-cell { grid-column: 1; display: flex; gap: 8px; flex-wrap: wrap; }
      .row-summary .disposition-cell span { margin-top: 0; }
      .row-summary .reason-cell, .row-summary .override-cell { display: none; }
      .chevron { grid-column: 2; grid-row: 1 / span 2; }
      .evidence-grid { grid-template-columns: 1fr; }
      .evidence-section { border-right: 0; border-bottom: 1px solid var(--line-soft); }
      .evidence-section:last-child { border-bottom: 0; }
      .decision-panel { grid-template-columns: 1fr; padding: 17px; }
      .notes-column { grid-column: auto; }
      .pagination { align-items: flex-start; flex-direction: column; }
      .page-actions { width: 100%; }
      .page-actions button { flex: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Dogs catalog review</h1>
    <div class="safety">
      <strong>Browser-local drafts only</strong>
      <span>No source files are changed. Exported JSON is a review aid, never an applied override.</span>
    </div>
    <button class="export-button" id="export-review" type="button">Export review notes</button>
  </header>

  <div class="review-layout">
    <aside class="filters" aria-label="Review filters">
      <div class="filters-inner">
        <div class="filters-heading">
          <h2>Filters</h2>
          <button class="clear-button" id="clear-filters" type="button">Clear all</button>
        </div>
        <div class="filter-group">
          <label for="search">Search evidence</label>
          <input id="search" type="search" placeholder="Label, id, alias, source…" autocomplete="off">
        </div>
        <div class="filter-group">
          <label for="review-status">Draft status</label>
          <select id="review-status">
            <option value="">All draft states</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="follow_up">Follow-up flagged</option>
            <option value="has_notes">Has notes</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="queue">Review queue</label>
          <select id="queue">
            <option value="">All queues</option>
            ${queueOptions}
          </select>
        </div>
        <div class="filter-group">
          <label for="disposition">Current disposition</label>
          <select id="disposition">
            <option value="">All dispositions</option>
            ${dispositionOptions}
          </select>
        </div>
        <div class="filter-group">
          <label for="reason">Reason code</label>
          <select id="reason">
            <option value="">All reason codes</option>
            ${reasonOptions}
          </select>
        </div>
        <div class="filter-group">
          <label for="override-context">Existing override context</label>
          <select id="override-context">
            <option value="">Any context</option>
            <option value="yes">Has explicit override context</option>
            <option value="no">No explicit override context</option>
          </select>
        </div>
        <p class="filter-note">
          Evidence is compiled from the pinned VBO artifact, classification, runtime catalog, and
          current override source. Review drafts stay in this browser until exported.
        </p>
      </div>
    </aside>

    <main class="review-main">
      <div class="review-toolbar">
        <div class="counts" aria-label="Review counts">
          <div class="count"><span>Total queue items</span><strong>${model.summary.queueItems}</strong></div>
          <div class="count"><span>Pending</span><strong id="pending-count">${model.summary.queueItems}</strong></div>
          <div class="count"><span>Reviewed</span><strong id="reviewed-count">0</strong></div>
          <div class="count"><span>Follow-up</span><strong id="follow-up-count">0</strong></div>
        </div>
        <div class="sort-control">
          <label for="sort">Sort</label>
          <select id="sort">
            <option value="queue">Queue, then label</option>
            <option value="label">Label A–Z</option>
            <option value="override">Existing override first</option>
            <option value="follow_up">Follow-up first</option>
          </select>
        </div>
        <button class="mobile-filter-toggle" id="toggle-filters" type="button" aria-expanded="false">
          Show filters
        </button>
      </div>
      <div class="results-meta">
        <span id="results-status" role="status" aria-live="polite"></span>
        <button id="clear-drafts" type="button">Clear local drafts</button>
      </div>
      <div class="review-list" id="review-list"></div>
      <p class="empty-results" id="empty-results" hidden>No queue items match these filters.</p>
      <div class="pagination" id="pagination">
        <span id="page-status"></span>
        <div class="page-actions">
          <button id="previous-page" type="button">Previous</button>
          <button id="next-page" type="button">Next</button>
        </div>
      </div>
    </main>
  </div>

  <script>
    (() => {
      "use strict";
      const model = ${safeJson(model)};
      const STORAGE_KEY = "stackrank:dogs-catalog-review:v1";
      const PAGE_SIZE = 40;
      const dispositionChoices = [
        "canonical", "alias", "variety", "crossbreed", "historical", "excluded"
      ];
      const queueOrder = new Map(
        model.summary.queueCounts.map((queue, index) => [queue.key, index])
      );
      const elements = {
        list: document.querySelector("#review-list"),
        empty: document.querySelector("#empty-results"),
        pagination: document.querySelector("#pagination"),
        pageStatus: document.querySelector("#page-status"),
        previous: document.querySelector("#previous-page"),
        next: document.querySelector("#next-page"),
        resultsStatus: document.querySelector("#results-status"),
        pendingCount: document.querySelector("#pending-count"),
        reviewedCount: document.querySelector("#reviewed-count"),
        followUpCount: document.querySelector("#follow-up-count"),
        search: document.querySelector("#search"),
        reviewStatus: document.querySelector("#review-status"),
        queue: document.querySelector("#queue"),
        disposition: document.querySelector("#disposition"),
        reason: document.querySelector("#reason"),
        overrideContext: document.querySelector("#override-context"),
        sort: document.querySelector("#sort"),
        filterPanel: document.querySelector(".filters"),
        toggleFilters: document.querySelector("#toggle-filters"),
        clearFilters: document.querySelector("#clear-filters"),
        clearDrafts: document.querySelector("#clear-drafts"),
        exportReview: document.querySelector("#export-review")
      };
      let state = loadState();
      let currentPage = 1;

      function emptyState() {
        return { schemaVersion: 1, reviews: {} };
      }

      function loadState() {
        try {
          const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
          if (parsed?.schemaVersion === 1 && parsed.reviews && typeof parsed.reviews === "object") {
            return parsed;
          }
        } catch {}
        return emptyState();
      }

      function saveState(message) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          if (message) elements.resultsStatus.textContent = message;
        } catch {
          elements.resultsStatus.textContent =
            "Browser storage is unavailable. Export now to keep these in-memory drafts.";
        }
        updateCounts();
      }

      function draftFor(reviewKey) {
        return state.reviews[reviewKey] || {
          status: "unreviewed",
          proposedDisposition: "",
          proposedTargetId: "",
          notes: "",
          followUp: false,
          updatedAt: ""
        };
      }

      function normalizeDraft(draft) {
        return {
          status: ["accept_current", "needs_override", "defer"].includes(draft.status)
            ? draft.status
            : "unreviewed",
          proposedDisposition: dispositionChoices.includes(draft.proposedDisposition)
            ? draft.proposedDisposition
            : "",
          proposedTargetId: String(draft.proposedTargetId || "").trim().slice(0, 160),
          notes: String(draft.notes || "").trim().slice(0, 4000),
          followUp: draft.followUp === true,
          updatedAt: String(draft.updatedAt || "")
        };
      }

      function draftHasContent(draft) {
        return draft.status !== "unreviewed" ||
          draft.proposedDisposition ||
          draft.proposedTargetId ||
          draft.notes ||
          draft.followUp;
      }

      function updateDraft(reviewKey, patch) {
        const draft = normalizeDraft({
          ...draftFor(reviewKey),
          ...patch,
          updatedAt: new Date().toISOString()
        });
        if (draftHasContent(draft)) state.reviews[reviewKey] = draft;
        else delete state.reviews[reviewKey];
        saveState("Local draft saved. No source files were changed.");
      }

      function reviewedCount() {
        return model.items.filter((item) => draftFor(item.reviewKey).status !== "unreviewed").length;
      }

      function updateCounts() {
        const reviewed = reviewedCount();
        const followUp = model.items.filter((item) => draftFor(item.reviewKey).followUp).length;
        elements.reviewedCount.textContent = String(reviewed);
        elements.pendingCount.textContent = String(model.summary.queueItems - reviewed);
        elements.followUpCount.textContent = String(followUp);
      }

      function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
      }

      function addDefinition(list, term, value) {
        const wrapper = makeElement("div");
        wrapper.append(makeElement("dt", "", term));
        const definition = makeElement("dd");
        if (value instanceof Node) definition.append(value);
        else definition.textContent = value || "None";
        wrapper.append(definition);
        list.append(wrapper);
      }

      function textList(values, emptyText = "None") {
        if (!values?.length) return makeElement("span", "empty-context", emptyText);
        const list = makeElement("ul");
        values.forEach((value) => list.append(makeElement("li", "", value)));
        return list;
      }

      function vboLink(id, label) {
        const link = makeElement("a", "", label || id);
        link.href = "http://purl.obolibrary.org/obo/" + id.replace(":", "_");
        link.target = "_blank";
        link.rel = "noreferrer";
        return link;
      }

      function sourceLinks(values) {
        if (!values?.length) return makeElement("span", "empty-context", "No source URLs on this VBO node");
        const wrapper = makeElement("div", "source-links");
        values.forEach((value) => {
          if (/^https?:\\/\\//i.test(value)) {
            const link = makeElement("a", "", value);
            link.href = value;
            link.target = "_blank";
            link.rel = "noreferrer";
            wrapper.append(link);
          } else {
            wrapper.append(makeElement("span", "empty-context", value));
          }
        });
        return wrapper;
      }

      function prettyJson(value) {
        return JSON.stringify(value, null, 2);
      }

      function evidenceSection(title) {
        const section = makeElement("section", "evidence-section");
        section.append(makeElement("h3", "", title));
        return section;
      }

      function classificationSection(item) {
        const section = evidenceSection("Current classification");
        const list = makeElement("dl");
        addDefinition(list, "Queue", item.queueLabel);
        addDefinition(list, "Disposition", item.currentDisposition);
        addDefinition(list, "Reason code", item.reasonCode);
        addDefinition(
          list,
          "Relation",
          item.relation
            ? item.relation.kind + ": " + item.relation.label + " (" + item.relation.id + ")"
            : "None"
        );
        addDefinition(list, "Raw queue entry", prettyJson(item.rawQueueEntry));
        section.append(list);
        return section;
      }

      function vboSection(item) {
        const section = evidenceSection("Pinned VBO context");
        const source = item.source || item.relatedSources[0];
        if (!source) {
          section.append(makeElement("p", "empty-context", "No VBO source node resolved."));
          return section;
        }
        const list = makeElement("dl");
        addDefinition(list, "Term", vboLink(source.id, source.label + " · " + source.id));
        addDefinition(
          list,
          "Parents",
          source.parents?.length
            ? textList(source.parents.map((parent) => parent.label + " · " + parent.id))
            : "None recorded"
        );
        addDefinition(list, "Exact synonyms", textList(source.synonyms));
        addDefinition(list, "Cross-references", textList(source.xrefs));
        if (source.definition) addDefinition(list, "Definition", source.definition);
        if (source.comments?.length) addDefinition(list, "Comments", textList(source.comments));
        if (!item.source && item.relatedSources.length > 1) {
          addDefinition(
            list,
            "Ambiguous owners",
            textList(item.relatedSources.map((entry) => entry.displayName + " · " + entry.id))
          );
        }
        section.append(list);
        return section;
      }

      function sourcesSection(item) {
        const section = evidenceSection("Source and runtime evidence");
        const sourceContexts = item.source ? [item.source, ...item.relatedSources] : item.relatedSources;
        const urls = [...new Set(sourceContexts.flatMap((source) => source.sources || []))];
        section.append(sourceLinks(urls));
        const list = makeElement("dl");
        addDefinition(
          list,
          "Runtime entities",
          item.runtimeEntities.length
            ? textList(item.runtimeEntities.map((entity) =>
                entity.displayName + " · " + entity.id + " · " + entity.status
              ))
            : "No runtime entity for this source term"
        );
        addDefinition(
          list,
          "Runtime aliases",
          textList([...new Set(item.runtimeEntities.flatMap((entity) => entity.aliases || []))])
        );
        section.append(list);
        return section;
      }

      function overridesSection(item) {
        const section = evidenceSection("Existing override context");
        if (!item.overrideContext.hasExplicitContext) {
          section.append(makeElement(
            "p",
            "empty-context",
            "No explicit classification, entity, alias-owner, exception, or reciprocal-exclusion override touches this item."
          ));
          return section;
        }
        const pre = makeElement("pre", "code-context", prettyJson({
          classificationDecisions: item.overrideContext.classificationDecisions,
          entityOverrides: item.overrideContext.entityOverrides,
          searchAliasOwners: item.overrideContext.searchAliasOwners,
          reciprocalAliasExclusions: item.overrideContext.reciprocalAliasExclusions,
          normalizedDisplayNameExceptions: item.overrideContext.normalizedDisplayNameExceptions
        }));
        section.append(pre);
        return section;
      }

      function decisionPanel(item, draft, stateLabel) {
        const panel = makeElement("div", "decision-panel");
        const fieldset = makeElement("fieldset");
        fieldset.append(makeElement("legend", "", "Draft decision"));
        const options = makeElement("div", "decision-options");
        [
          ["unreviewed", "Not reviewed"],
          ["accept_current", "Accept current classification"],
          ["needs_override", "Propose an override"],
          ["defer", "Defer for follow-up"]
        ].forEach(([value, label]) => {
          const wrapper = makeElement("label");
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "decision:" + item.reviewKey;
          input.value = value;
          input.checked = draft.status === value;
          input.addEventListener("change", () => {
            updateDraft(item.reviewKey, { status: value });
            stateLabel.textContent = decisionLabel(value);
            stateLabel.classList.toggle("is-reviewed", value !== "unreviewed");
            render(false);
          });
          wrapper.append(input, makeElement("span", "", label));
          options.append(wrapper);
        });
        fieldset.append(options);

        const proposals = makeElement("div", "proposal-fields");
        const dispositionLabel = makeElement("label");
        dispositionLabel.append(makeElement("span", "", "Proposed disposition"));
        const disposition = document.createElement("select");
        disposition.append(new Option("No proposal", ""));
        dispositionChoices.forEach((value) => disposition.append(new Option(value, value)));
        disposition.value = draft.proposedDisposition;
        disposition.addEventListener("change", () =>
          updateDraft(item.reviewKey, { proposedDisposition: disposition.value })
        );
        dispositionLabel.append(disposition);
        const targetLabel = makeElement("label");
        targetLabel.append(makeElement("span", "", "Proposed target / parent VBO id"));
        const target = document.createElement("input");
        target.type = "text";
        target.placeholder = "VBO:0000000 or concise review note";
        target.maxLength = 160;
        target.value = draft.proposedTargetId;
        target.addEventListener("change", () =>
          updateDraft(item.reviewKey, { proposedTargetId: target.value })
        );
        targetLabel.append(target);
        proposals.append(dispositionLabel, targetLabel);

        const notesColumn = makeElement("div", "notes-column");
        const notesLabel = makeElement("label", "notes-field");
        notesLabel.append(makeElement("span", "", "Review notes"));
        const notes = document.createElement("textarea");
        notes.rows = 4;
        notes.maxLength = 4000;
        notes.placeholder = "Record exact evidence, uncertainty, or the override to investigate…";
        notes.value = draft.notes;
        notes.addEventListener("change", () => updateDraft(item.reviewKey, { notes: notes.value }));
        notesLabel.append(notes);
        const followUp = makeElement("label", "follow-up");
        const followUpInput = document.createElement("input");
        followUpInput.type = "checkbox";
        followUpInput.checked = draft.followUp;
        followUpInput.addEventListener("change", () =>
          updateDraft(item.reviewKey, { followUp: followUpInput.checked })
        );
        followUp.append(followUpInput, makeElement("span", "", "Flag for follow-up"));
        notesColumn.append(notesLabel, followUp);
        panel.append(fieldset, proposals, notesColumn);
        return panel;
      }

      function decisionLabel(value) {
        return ({
          unreviewed: "Unreviewed",
          accept_current: "Accept current",
          needs_override: "Override proposed",
          defer: "Deferred"
        })[value] || "Unreviewed";
      }

      function reviewRow(item, open) {
        const draft = draftFor(item.reviewKey);
        const article = makeElement("article", "review-row");
        article.dataset.reviewKey = item.reviewKey;
        const details = document.createElement("details");
        details.open = open;
        const summary = makeElement("summary", "row-summary");
        const title = makeElement("div", "row-title");
        title.append(
          makeElement("strong", "", item.primaryLabel),
          makeElement("span", "", item.primaryId || item.subjectIds.join(" · "))
        );
        const disposition = makeElement("div", "row-cell disposition-cell");
        disposition.append(
          makeElement("strong", "", item.currentDisposition.replaceAll("_", " ")),
          makeElement("span", "", item.queueLabel)
        );
        const reason = makeElement("div", "row-cell reason-cell");
        reason.append(
          makeElement("strong", "", item.reasonCode.replaceAll("_", " ")),
          makeElement("span", "", item.relation
            ? item.relation.kind + ": " + item.relation.label
            : "No target / parent")
        );
        const override = makeElement("div", "row-cell override-cell");
        override.append(
          makeElement("strong", "", item.overrideContext.hasExplicitContext
            ? "Existing context"
            : "No explicit override"),
        );
        const stateLabel = makeElement(
          "span",
          "draft-state" + (draft.status !== "unreviewed" ? " is-reviewed" : ""),
          decisionLabel(draft.status)
        );
        override.append(stateLabel);
        const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        chevron.setAttribute("class", "chevron");
        chevron.setAttribute("viewBox", "0 0 20 20");
        chevron.setAttribute("aria-hidden", "true");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M4 7.5 10 13l6-5.5");
        chevron.append(path);
        summary.append(title, disposition, reason, override, chevron);

        const body = makeElement("div", "row-body");
        const evidence = makeElement("div", "evidence-grid");
        evidence.append(
          classificationSection(item),
          vboSection(item),
          sourcesSection(item),
          overridesSection(item)
        );
        body.append(
          evidence,
          decisionPanel(item, draft, stateLabel),
          makeElement(
            "p",
            "local-state-line",
            "Draft key: " + item.reviewKey +
              ". Export does not edit classification.json, catalog-overrides.json, or compiled artifacts."
          )
        );
        details.append(summary, body);
        article.append(details);
        return article;
      }

      function filteredItems() {
        const query = elements.search.value.trim().toLocaleLowerCase("en");
        const status = elements.reviewStatus.value;
        const queue = elements.queue.value;
        const disposition = elements.disposition.value;
        const reason = elements.reason.value;
        const overrideContext = elements.overrideContext.value;
        const filtered = model.items.filter((item) => {
          const draft = draftFor(item.reviewKey);
          if (query && !item.searchText.includes(query)) return false;
          if (queue && item.queue !== queue) return false;
          if (disposition && item.currentDisposition !== disposition) return false;
          if (reason && item.reasonCode !== reason) return false;
          if (
            overrideContext &&
            item.overrideContext.hasExplicitContext !== (overrideContext === "yes")
          ) return false;
          if (status === "unreviewed" && draft.status !== "unreviewed") return false;
          if (status === "reviewed" && draft.status === "unreviewed") return false;
          if (status === "follow_up" && !draft.followUp) return false;
          if (status === "has_notes" && !draft.notes) return false;
          return true;
        });
        const sort = elements.sort.value;
        filtered.sort((left, right) => {
          if (sort === "label") {
            return left.primaryLabel.localeCompare(right.primaryLabel, "en");
          }
          if (sort === "override") {
            return Number(right.overrideContext.hasExplicitContext) -
              Number(left.overrideContext.hasExplicitContext) ||
              left.primaryLabel.localeCompare(right.primaryLabel, "en");
          }
          if (sort === "follow_up") {
            return Number(draftFor(right.reviewKey).followUp) -
              Number(draftFor(left.reviewKey).followUp) ||
              left.primaryLabel.localeCompare(right.primaryLabel, "en");
          }
          return queueOrder.get(left.queue) - queueOrder.get(right.queue) ||
            left.primaryLabel.localeCompare(right.primaryLabel, "en");
        });
        return filtered;
      }

      function render(resetPage = true) {
        if (resetPage) currentPage = 1;
        const items = filteredItems();
        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = items.slice(start, start + PAGE_SIZE);
        elements.list.replaceChildren(
          ...pageItems.map((item, index) => reviewRow(item, currentPage === 1 && index === 0))
        );
        elements.empty.hidden = items.length > 0;
        elements.pagination.hidden = items.length === 0;
        elements.resultsStatus.textContent =
          items.length + " of " + model.summary.queueItems + " queue items shown by current filters.";
        elements.pageStatus.textContent = items.length
          ? "Showing " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, items.length) +
            " of " + items.length + " · page " + currentPage + " of " + totalPages
          : "";
        elements.previous.disabled = currentPage <= 1;
        elements.next.disabled = currentPage >= totalPages;
        updateCounts();
      }

      function clearFilters() {
        elements.search.value = "";
        elements.reviewStatus.value = "";
        elements.queue.value = "";
        elements.disposition.value = "";
        elements.reason.value = "";
        elements.overrideContext.value = "";
        elements.sort.value = "queue";
        render();
      }

      function exportReview() {
        const reviews = model.items
          .map((item) => {
            const draft = normalizeDraft(draftFor(item.reviewKey));
            if (!draftHasContent(draft)) return null;
            return {
              reviewKey: item.reviewKey,
              queue: item.queue,
              queueLabel: item.queueLabel,
              primaryLabel: item.primaryLabel,
              primaryId: item.primaryId || null,
              subjectIds: item.subjectIds,
              currentDisposition: item.currentDisposition,
              reasonCode: item.reasonCode,
              relation: item.relation,
              draft
            };
          })
          .filter(Boolean);
        const payload = {
          schemaVersion: 1,
          kind: "stackrank-dogs-catalog-review-draft",
          exportedAt: new Date().toISOString(),
          notice:
            "Review aid only. This file does not apply or authorize changes to catalog source or compiled artifacts.",
          generatedFrom: model.generatedFrom,
          reviews
        };
        const blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "stackrank-dogs-catalog-review-" +
          new Date().toISOString().slice(0, 10) + ".json";
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        elements.resultsStatus.textContent =
          reviews.length + " local draft" + (reviews.length === 1 ? "" : "s") +
          " exported. No source files were changed.";
      }

      [
        elements.search,
        elements.reviewStatus,
        elements.queue,
        elements.disposition,
        elements.reason,
        elements.overrideContext,
        elements.sort
      ].forEach((control) => control.addEventListener(
        control === elements.search ? "input" : "change",
        () => render()
      ));
      elements.clearFilters.addEventListener("click", clearFilters);
      elements.toggleFilters.addEventListener("click", () => {
        const isOpen = elements.filterPanel.classList.toggle("is-open");
        elements.toggleFilters.setAttribute("aria-expanded", String(isOpen));
        elements.toggleFilters.textContent = isOpen ? "Hide filters" : "Show filters";
        if (isOpen) {
          requestAnimationFrame(() => {
            elements.filterPanel.scrollIntoView({ block: "start", behavior: "smooth" });
            elements.search.focus({ preventScroll: true });
          });
        }
      });
      elements.previous.addEventListener("click", () => {
        currentPage -= 1;
        render(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      elements.next.addEventListener("click", () => {
        currentPage += 1;
        render(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      elements.exportReview.addEventListener("click", exportReview);
      elements.clearDrafts.addEventListener("click", () => {
        if (!confirm(
          "Clear all browser-local catalog review drafts? Source files are not affected."
        )) return;
        state = emptyState();
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        elements.resultsStatus.textContent =
          "Browser-local drafts cleared. No source files were changed.";
        render(false);
      });

      render();
    })();
  </script>
</body>
</html>
`;
}

export async function writeCatalogReviewReport(outPath = DEFAULT_OUT) {
  const dataRoot = path.join(ROOT, "data", "dogs");
  const [review, classification, overrides, catalog, ontology] = await Promise.all(
    [
      "classification-review.json",
      "classification.json",
      "catalog-overrides.json",
      "dog-catalog.json",
      "sources/vbo-2026-04-15.json",
    ].map(async (file) => JSON.parse(await readFile(path.join(dataRoot, file), "utf8"))),
  );
  const model = buildCatalogReviewModel({
    review,
    classification,
    overrides,
    catalog,
    ontology,
  });
  const html = renderCatalogReviewHtml(model);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  return { outPath, model, bytes: Buffer.byteLength(html) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: node scripts/build-dog-catalog-review.mjs [--out reports/dogs-catalog-review/index.html]",
    );
    return;
  }
  const result = await writeCatalogReviewReport(args.out);
  console.log(
    `Built ${result.model.summary.queueItems} Dogs catalog review rows (${result.bytes} bytes)`,
  );
  console.log(`Report: ${path.relative(ROOT, result.outPath)}`);
  console.log("Browser-local drafts only; catalog source and compiled artifacts are unchanged.");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
