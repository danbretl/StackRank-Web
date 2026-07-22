#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "reports", "dogs-artwork-review", "index.html");

const asArray = (value) => (Array.isArray(value) ? value : []);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

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

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

const revisionUrl = (sourcePage, revisionId) => {
  try {
    const url = new URL(sourcePage);
    url.searchParams.set("oldid", String(revisionId));
    return url.toString();
  } catch {
    return sourcePage;
  }
};

export function buildArtworkReviewModel({ ledger, catalog, packs } = {}) {
  const entities = asArray(catalog?.entities);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const promotedIds = new Set(
    asArray(packs?.packs)
      .filter((pack) => pack?.promoted === true)
      .flatMap((pack) => asArray(pack.items)),
  );
  const assets = asArray(ledger?.assets).map((asset) => {
    const entity = entityById.get(asset.catalogId);
    return {
      assetId: cleanText(asset.assetId),
      catalogId: cleanText(asset.catalogId),
      displayName: cleanText(entity?.displayName) || cleanText(asset.title) || cleanText(asset.catalogId),
      promoted: promotedIds.has(asset.catalogId),
      aliases: asArray(entity?.aliases).map(cleanText).filter(Boolean),
      status: cleanText(entity?.status),
      sourcePage: cleanText(asset.sourcePage),
      pinnedSourcePage: revisionUrl(asset.sourcePage, asset.sourcePageRevision?.id),
      revisionId: Number(asset.sourcePageRevision?.id) || null,
      revisionTimestamp: cleanText(asset.sourcePageRevision?.timestamp),
      originalUrl: cleanText(asset.originalUrl),
      title: cleanText(asset.title),
      creator: cleanText(asset.creator),
      creatorUrl: cleanText(asset.creatorUrl),
      licenseId: cleanText(asset.licenseId),
      license: cleanText(asset.license),
      licenseUrl: cleanText(asset.licenseUrl),
      sourceCredit: cleanText(asset.sourceCredit),
      attribution: cleanText(asset.attribution),
      sourceSha256: cleanText(asset.sourceSha256),
      sourceSha1: cleanText(asset.sourceSha1),
      sourceMime: cleanText(asset.sourceMime),
      sourceBytes: Number(asset.sourceBytes) || 0,
      sourceBytesLabel: formatBytes(asset.sourceBytes),
      sourceWidth: Number(asset.sourceWidth) || 0,
      sourceHeight: Number(asset.sourceHeight) || 0,
      retrievedAt: cleanText(asset.retrievedAt),
      ledgerReviewStatus: cleanText(asset.review?.status) || "pending",
      ledgerRightsNotes: cleanText(asset.review?.rightsNotes),
    };
  });
  assets.sort((left, right) =>
    Number(right.promoted) - Number(left.promoted) ||
    left.displayName.localeCompare(right.displayName) ||
    left.catalogId.localeCompare(right.catalogId));

  const licenseCounts = Object.entries(
    assets.reduce((counts, asset) => {
      counts[asset.license] = (counts[asset.license] || 0) + 1;
      return counts;
    }, {}),
  )
    .map(([license, count]) => ({ license, count }))
    .sort((left, right) => right.count - left.count || left.license.localeCompare(right.license));

  return {
    schemaVersion: 1,
    generatedFrom: {
      ledgerVersion: cleanText(ledger?.ledgerVersion),
      catalogVersion: cleanText(ledger?.catalogVersion || catalog?.catalogVersion),
      policyVersion: cleanText(ledger?.policyVersion),
      ledgerUpdatedAt: cleanText(ledger?.updatedAt),
    },
    summary: {
      candidates: assets.length,
      promoted: assets.filter((asset) => asset.promoted).length,
      pending: assets.filter((asset) => asset.ledgerReviewStatus === "pending").length,
      licenses: licenseCounts,
    },
    assets,
  };
}

const renderLicenseFilters = (licenses) =>
  licenses.map(({ license, count }) => `
    <label class="filter-check">
      <input type="checkbox" data-license-filter value="${escapeHtml(license)}">
      <span>${escapeHtml(license)}</span>
      <small>${count}</small>
    </label>
  `).join("");

const renderReviewOptions = (asset, field, legend, choices) => `
  <fieldset class="review-field">
    <legend>${escapeHtml(legend)}</legend>
    ${choices.map(({ value, label }) => `
      <label>
        <input
          type="radio"
          name="${escapeHtml(`${asset.assetId}:${field}`)}"
          value="${escapeHtml(value)}"
          data-review-field="${escapeHtml(field)}"
          data-asset-id="${escapeHtml(asset.assetId)}"
          ${value === "unreviewed" ? "checked" : ""}
        >
        <span>${escapeHtml(label)}</span>
      </label>
    `).join("")}
  </fieldset>
`;

const renderCandidate = (asset, index) => `
  <article
    class="candidate"
    data-candidate
    data-asset-id="${escapeHtml(asset.assetId)}"
    data-name="${escapeHtml(asset.displayName.toLowerCase())}"
    data-license="${escapeHtml(asset.license)}"
    data-promoted="${asset.promoted}"
  >
    <details ${index === 0 ? "open" : ""}>
      <summary class="candidate-summary">
        <span class="photo-frame">
          <img
            src="${escapeHtml(asset.originalUrl)}"
            alt="${escapeHtml(`${asset.displayName} candidate from Wikimedia Commons`)}"
            loading="${index < 2 ? "eager" : "lazy"}"
            decoding="async"
            referrerpolicy="no-referrer"
          >
          <span class="photo-fallback" aria-hidden="true">${escapeHtml(asset.displayName.slice(0, 1))}</span>
        </span>
        <span class="candidate-heading">
          <span class="candidate-title-line">
            ${asset.promoted ? '<span class="promoted-label">Promoted</span>' : ""}
            <strong>${escapeHtml(asset.displayName)}</strong>
          </span>
          <span class="candidate-id">${escapeHtml(asset.catalogId)} · ${escapeHtml(asset.status)}</span>
          <span class="candidate-source">${escapeHtml(asset.license)} · ${escapeHtml(asset.creator)}</span>
        </span>
        <span class="candidate-proof">
          <span>${asset.sourceWidth} × ${asset.sourceHeight}px</span>
          <span>${escapeHtml(asset.sourceBytesLabel)}</span>
          <span>SHA-256 verified</span>
        </span>
        <span class="candidate-index">${index + 1}</span>
      </summary>

      <div class="candidate-body">
        <dl class="evidence-grid">
          <div><dt>Commons title</dt><dd>${escapeHtml(asset.title)}</dd></div>
          <div><dt>Creator</dt><dd>${escapeHtml(asset.creator)}</dd></div>
          <div><dt>License</dt><dd>${escapeHtml(asset.license)} (${escapeHtml(asset.licenseId)})</dd></div>
          <div><dt>Pinned revision</dt><dd>${asset.revisionId || "Unknown"} · ${escapeHtml(asset.revisionTimestamp)}</dd></div>
          <div><dt>Source credit</dt><dd>${escapeHtml(asset.sourceCredit || "Not supplied")}</dd></div>
          <div><dt>Retrieved</dt><dd>${escapeHtml(asset.retrievedAt)}</dd></div>
          <div class="hash"><dt>SHA-256</dt><dd>${escapeHtml(asset.sourceSha256)}</dd></div>
          <div class="hash"><dt>Commons SHA-1</dt><dd>${escapeHtml(asset.sourceSha1)}</dd></div>
        </dl>

        <div class="source-actions" aria-label="Source evidence">
          <a href="${escapeHtml(asset.pinnedSourcePage)}" target="_blank" rel="noreferrer">Pinned file revision</a>
          <a href="${escapeHtml(asset.sourcePage)}" target="_blank" rel="noreferrer">Current Commons page</a>
          <a href="${escapeHtml(asset.originalUrl)}" target="_blank" rel="noreferrer">Full-resolution original</a>
          <a href="${escapeHtml(asset.licenseUrl)}" target="_blank" rel="noreferrer">License text</a>
          ${asset.creatorUrl ? `<a href="${escapeHtml(asset.creatorUrl)}" target="_blank" rel="noreferrer">Creator page</a>` : ""}
        </div>

        <div class="review-grid">
          ${renderReviewOptions(asset, "subject", "Subject matches catalog", [
            { value: "matches", label: "Matches catalog concept" },
            { value: "does_not_match", label: "Does not match" },
            { value: "unreviewed", label: "Not reviewed" },
          ])}
          ${renderReviewOptions(asset, "license", "License chain verified", [
            { value: "verified", label: "Verified" },
            { value: "issues_found", label: "Issues found" },
            { value: "unreviewed", label: "Not reviewed" },
          ])}
          ${renderReviewOptions(asset, "restrictions", "Non-copyright restrictions reviewed", [
            { value: "none_found", label: "No restrictions found" },
            { value: "potential_issues", label: "Potential issues" },
            { value: "unreviewed", label: "Not reviewed" },
          ])}
        </div>

        <label class="notes-field">
          <span>Review notes (local only)</span>
          <textarea
            rows="3"
            maxlength="2000"
            placeholder="Record concrete subject, rights-chain, attribution, or restriction findings…"
            data-review-notes
            data-asset-id="${escapeHtml(asset.assetId)}"
          ></textarea>
        </label>

        <label class="follow-up">
          <input type="checkbox" data-review-follow-up data-asset-id="${escapeHtml(asset.assetId)}">
          <span>Flag for follow-up</span>
        </label>

        <p class="attribution">${escapeHtml(asset.attribution)}</p>
        <p class="ledger-note"><strong>Ledger state:</strong> ${escapeHtml(asset.ledgerReviewStatus)}. ${escapeHtml(asset.ledgerRightsNotes)}</p>
      </div>
    </details>
  </article>
`;

export function renderArtworkReviewHtml(model) {
  const title = "StackRank Dogs — Artwork review";
  const candidateMarkup = model.assets.map(renderCandidate).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f2f2f2;
      --surface: #fff;
      --ink: #111;
      --muted: #686868;
      --rule: #111;
      --soft-rule: #d8d8d8;
      --subtle: #f7f7f7;
      --warning: #82500c;
      --radius: 10px;
      font-family: "Space Grotesk", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
    }

    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    html { background: var(--bg); color: var(--ink); }
    body { margin: 0; min-width: 320px; }
    button, input, select, textarea { font: inherit; }
    button, select, input[type="checkbox"], input[type="radio"], summary { cursor: pointer; }
    a { color: inherit; text-underline-offset: 3px; }
    :focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }

    .shell { width: min(1500px, 100%); margin: 0 auto; padding: 22px 28px 104px; }
    .topbar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 18px;
      border-bottom: 2px solid var(--rule);
    }
    .topbar h1 { margin: 0; font-size: clamp(1.5rem, 2.4vw, 2.45rem); letter-spacing: -0.045em; }
    .topbar h1 span { font-size: 0.62em; font-weight: 500; letter-spacing: -0.02em; }
    .headline-count { margin: 0; font-size: clamp(1.15rem, 1.8vw, 1.8rem); font-weight: 750; white-space: nowrap; }
    .warning {
      display: flex;
      gap: 10px;
      align-items: center;
      margin: 16px 0 22px;
      padding: 12px 14px;
      border: 1px solid var(--rule);
      color: var(--warning);
      background: var(--surface);
      font-weight: 650;
    }
    .warning::before { content: "△"; font-size: 1.15rem; }

    .workspace { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 30px; align-items: start; }
    .filters {
      position: sticky;
      top: 16px;
      padding-right: 24px;
      border-right: 1px solid var(--rule);
    }
    .filters h2, .filters h3 { margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; }
    .filters h3 { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--soft-rule); }
    .filters select { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid var(--rule); background: var(--surface); }
    .filter-check { display: grid; grid-template-columns: 20px 1fr auto; gap: 8px; align-items: center; min-height: 36px; font-size: 0.88rem; }
    .filter-check input { width: 18px; height: 18px; margin: 0; }
    .filter-check small { color: var(--muted); }
    .summary-list { display: grid; gap: 8px; margin: 0; }
    .summary-list div { display: flex; justify-content: space-between; gap: 12px; }
    .summary-list dt, .summary-list dd { margin: 0; font-size: 0.86rem; }
    .summary-list dd { font-weight: 700; }
    .local-only {
      margin-top: 28px;
      padding: 12px;
      border: 1px solid var(--rule);
      font-size: 0.78rem;
      line-height: 1.45;
      color: var(--muted);
      background: var(--surface);
    }

    .review-main { min-width: 0; }
    .review-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: center;
      margin-bottom: 12px;
      min-height: 34px;
    }
    .review-toolbar p { margin: 0; color: var(--muted); }
    .review-toolbar input {
      width: min(310px, 46vw);
      min-height: 42px;
      padding: 8px 12px;
      border: 1px solid var(--rule);
      background: var(--surface);
    }
    .candidate-list { display: grid; gap: 12px; }
    .candidate { border: 1px solid var(--rule); background: var(--surface); box-shadow: 0 5px 15px rgb(0 0 0 / 0.04); }
    .candidate details[open] { border-bottom: 4px solid var(--rule); }
    .candidate-summary {
      display: grid;
      grid-template-columns: minmax(210px, 31%) minmax(220px, 1fr) minmax(140px, auto) 34px;
      gap: 18px;
      align-items: center;
      min-height: 170px;
      padding: 14px;
      list-style: none;
    }
    .candidate-summary::-webkit-details-marker { display: none; }
    .candidate-summary::after { content: "⌄"; position: absolute; opacity: 0; }
    .photo-frame { position: relative; display: block; overflow: hidden; width: 100%; aspect-ratio: 3 / 2; background: #e4e4e4; }
    .photo-frame img { position: relative; z-index: 1; width: 100%; height: 100%; object-fit: contain; filter: grayscale(1); }
    .photo-fallback { position: absolute; inset: 0; display: grid; place-items: center; font-size: 3rem; font-weight: 800; color: #777; }
    .candidate-heading { display: grid; gap: 9px; align-self: start; padding-top: 5px; }
    .candidate-title-line { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .candidate-title-line strong { font-size: clamp(1.1rem, 1.5vw, 1.45rem); }
    .promoted-label {
      display: inline-block;
      padding: 4px 7px;
      background: var(--ink);
      color: white;
      font-size: 0.66rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .candidate-id, .candidate-source { color: var(--muted); font-size: 0.85rem; }
    .candidate-proof { display: grid; gap: 8px; align-self: start; padding-top: 8px; font-size: 0.8rem; text-align: right; }
    .candidate-index { align-self: start; padding-top: 8px; font-size: 0.78rem; color: var(--muted); text-align: right; }
    .candidate details[open] .candidate-index::after { content: " ▲"; color: var(--ink); }
    .candidate details:not([open]) .candidate-index::after { content: " ▼"; color: var(--ink); }

    .candidate-body { padding: 22px; border-top: 1px solid var(--soft-rule); }
    .evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 22px; margin: 0; }
    .evidence-grid div { min-width: 0; }
    .evidence-grid dt { margin-bottom: 4px; color: var(--muted); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .evidence-grid dd { margin: 0; overflow-wrap: anywhere; font-size: 0.86rem; line-height: 1.45; }
    .evidence-grid .hash { grid-column: span 1; }
    .source-actions { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 20px 0; padding: 14px 0; border-block: 1px solid var(--soft-rule); }
    .source-actions a { min-height: 30px; font-size: 0.82rem; font-weight: 700; }
    .source-actions a::after { content: " ↗"; }
    .review-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--rule); }
    .review-field { min-width: 0; margin: 0; padding: 16px; border: 0; }
    .review-field + .review-field { border-left: 1px solid var(--rule); }
    .review-field legend { padding: 0; margin-bottom: 10px; font-weight: 750; font-size: 0.9rem; }
    .review-field label { display: flex; gap: 8px; align-items: flex-start; min-height: 34px; font-size: 0.82rem; }
    .review-field input { width: 18px; height: 18px; margin: 0; flex: 0 0 auto; }
    .notes-field { display: grid; gap: 7px; margin-top: 16px; font-size: 0.84rem; font-weight: 700; }
    .notes-field textarea { width: 100%; resize: vertical; padding: 10px; border: 1px solid var(--rule); line-height: 1.45; font-weight: 400; }
    .follow-up { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 0.82rem; }
    .follow-up input { width: 18px; height: 18px; margin: 0; }
    .attribution, .ledger-note { margin: 14px 0 0; color: var(--muted); font-size: 0.78rem; line-height: 1.5; }

    .export-bar {
      position: fixed;
      z-index: 10;
      inset: auto 0 0;
      display: flex;
      justify-content: center;
      gap: 18px;
      align-items: center;
      min-height: 76px;
      padding: 12px 24px;
      border-top: 1px solid var(--rule);
      background: rgb(255 255 255 / 0.96);
      backdrop-filter: blur(10px);
    }
    .export-bar button {
      min-width: min(460px, 80vw);
      min-height: 48px;
      border: 3px double var(--rule);
      background: var(--surface);
      color: var(--ink);
      font-weight: 800;
    }
    .export-bar p { margin: 0; color: var(--muted); font-size: 0.8rem; }
    .empty { padding: 44px; border: 1px solid var(--rule); background: var(--surface); text-align: center; }
    .status { min-height: 1.2em; color: var(--muted); font-size: 0.78rem; }

    @media (max-width: 980px) {
      .shell { padding-inline: 18px; }
      .workspace { grid-template-columns: 1fr; }
      .filters { position: static; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 22px; padding: 18px; border: 1px solid var(--rule); background: var(--surface); }
      .filters > h2, .filters > .local-only { grid-column: 1 / -1; }
      .filters h3 { margin-top: 10px; }
      .candidate-summary { grid-template-columns: minmax(190px, 35%) 1fr 32px; }
      .candidate-proof { display: none; }
      .evidence-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 680px) {
      .shell { padding: 14px 12px 118px; }
      .topbar { align-items: flex-start; flex-direction: column; gap: 8px; }
      .headline-count { white-space: normal; }
      .review-main { order: 1; }
      .filters { order: 2; }
      .filters { grid-template-columns: 1fr; }
      .filters > h2, .filters > .local-only { grid-column: auto; }
      .review-toolbar { align-items: stretch; flex-direction: column; }
      .review-toolbar input { width: 100%; }
      .candidate-summary { grid-template-columns: 1fr 32px; gap: 12px; }
      .photo-frame, .candidate-heading { grid-column: 1; }
      .candidate-index { grid-column: 2; grid-row: 1; }
      .candidate-body { padding: 14px; }
      .evidence-grid, .review-grid { grid-template-columns: 1fr; }
      .review-field + .review-field { border-left: 0; border-top: 1px solid var(--rule); }
      .export-bar { align-items: stretch; flex-direction: column; gap: 4px; min-height: 96px; }
      .export-bar button { width: 100%; min-width: 0; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <h1>StackRank Dogs <span>— Artwork review</span></h1>
      <p class="headline-count"><span data-reviewed-count>0</span> reviewed · <span data-pending-count>${model.summary.candidates}</span> pending</p>
    </header>
    <div class="warning">Review notes do not alter the rights ledger.</div>

    <div class="workspace">
      <aside class="filters" aria-label="Review filters">
        <h2>Filters</h2>
        <div>
          <label for="review-sort"><small>Sort order</small></label>
          <select id="review-sort">
            <option value="promoted">Promoted first</option>
            <option value="name">Breed name</option>
            <option value="license">License</option>
          </select>
          <label class="filter-check">
            <input type="checkbox" id="filter-promoted">
            <span>Promoted only</span>
            <small>${model.summary.promoted}</small>
          </label>
          <label class="filter-check">
            <input type="checkbox" id="filter-pending">
            <span>Pending only</span>
            <small data-pending-count>${model.summary.candidates}</small>
          </label>
          <label class="filter-check">
            <input type="checkbox" id="filter-notes">
            <span>Notes present</span>
            <small data-notes-count>0</small>
          </label>
          <label class="filter-check">
            <input type="checkbox" id="filter-follow-up">
            <span>Flagged</span>
            <small data-follow-up-count>0</small>
          </label>
        </div>

        <div>
          <h3>License filters</h3>
          ${renderLicenseFilters(model.summary.licenses)}
        </div>

        <div>
          <h3>Progress summary</h3>
          <dl class="summary-list">
            <div><dt>Total candidates</dt><dd>${model.summary.candidates}</dd></div>
            <div><dt>Promoted</dt><dd>${model.summary.promoted}</dd></div>
            <div><dt>Fully reviewed</dt><dd data-reviewed-count>0</dd></div>
            <div><dt>Pending</dt><dd data-pending-count>${model.summary.candidates}</dd></div>
            <div><dt>Notes present</dt><dd data-notes-count>0</dd></div>
          </dl>
        </div>

        <p class="local-only">All decisions stay in this browser until exported. Exported notes are a review aid, not approval and not a ledger mutation.</p>
      </aside>

      <section class="review-main" aria-labelledby="candidate-heading">
        <div class="review-toolbar">
          <p id="candidate-heading">Showing <strong data-visible-count>${model.summary.candidates}</strong> of ${model.summary.candidates} candidates</p>
          <label>
            <span class="sr-only" hidden>Search candidates</span>
            <input id="candidate-search" type="search" placeholder="Search breed, VBO id, creator, license">
          </label>
        </div>
        <div class="candidate-list" data-candidate-list>
          ${candidateMarkup}
        </div>
        <p class="empty" data-empty hidden>No candidates match these filters.</p>
      </section>
    </div>
  </main>

  <footer class="export-bar">
    <button type="button" id="export-review">Export review notes</button>
    <p class="status" id="review-status" aria-live="polite"></p>
  </footer>

  <script type="application/json" id="review-model">${safeJson(model)}</script>
  <script>
    (() => {
      const model = JSON.parse(document.querySelector('#review-model').textContent);
      const storageKey = 'stackrank:dogs-artwork-review:v1';
      const defaults = () => ({
        subject: 'unreviewed',
        license: 'unreviewed',
        restrictions: 'unreviewed',
        notes: '',
        followUp: false
      });
      let state = Object.create(null);
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed;
      } catch {
        state = Object.create(null);
      }
      const candidates = [...document.querySelectorAll('[data-candidate]')];
      const status = document.querySelector('#review-status');
      const valueFor = (assetId) => ({ ...defaults(), ...(state[assetId] || {}) });
      const fullyReviewed = (review) =>
        review.subject !== 'unreviewed' &&
        review.license !== 'unreviewed' &&
        review.restrictions !== 'unreviewed';
      const save = () => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(state));
          status.textContent = 'Local notes saved.';
        } catch {
          status.textContent = 'Local storage failed. Export now to avoid losing notes.';
        }
      };
      const restore = () => {
        candidates.forEach((candidate) => {
          const assetId = candidate.dataset.assetId;
          const review = valueFor(assetId);
          candidate.querySelectorAll('[data-review-field]').forEach((input) => {
            input.checked = input.value === review[input.dataset.reviewField];
          });
          candidate.querySelector('[data-review-notes]').value = review.notes || '';
          candidate.querySelector('[data-review-follow-up]').checked = review.followUp === true;
          candidate.dataset.reviewed = String(fullyReviewed(review));
          candidate.dataset.hasNotes = String(Boolean((review.notes || '').trim()));
          candidate.dataset.followUp = String(review.followUp === true);
        });
      };
      const updateCounts = () => {
        const reviews = model.assets.map((asset) => valueFor(asset.assetId));
        const reviewed = reviews.filter(fullyReviewed).length;
        const notes = reviews.filter((review) => (review.notes || '').trim()).length;
        const followUp = reviews.filter((review) => review.followUp === true).length;
        document.querySelectorAll('[data-reviewed-count]').forEach((node) => { node.textContent = reviewed; });
        document.querySelectorAll('[data-pending-count]').forEach((node) => {
          node.textContent = model.assets.length - reviewed;
        });
        document.querySelectorAll('[data-notes-count]').forEach((node) => { node.textContent = notes; });
        document.querySelectorAll('[data-follow-up-count]').forEach((node) => { node.textContent = followUp; });
      };
      const applyFilters = () => {
        const query = document.querySelector('#candidate-search').value.trim().toLowerCase();
        const promotedOnly = document.querySelector('#filter-promoted').checked;
        const pendingOnly = document.querySelector('#filter-pending').checked;
        const notesOnly = document.querySelector('#filter-notes').checked;
        const followUpOnly = document.querySelector('#filter-follow-up').checked;
        const licenses = new Set(
          [...document.querySelectorAll('[data-license-filter]:checked')].map((input) => input.value)
        );
        let visible = 0;
        candidates.forEach((candidate) => {
          const asset = model.assets.find((item) => item.assetId === candidate.dataset.assetId);
          const haystack = [
            asset.displayName,
            asset.catalogId,
            asset.creator,
            asset.license,
            asset.title
          ].join(' ').toLowerCase();
          const show =
            (!query || haystack.includes(query)) &&
            (!promotedOnly || candidate.dataset.promoted === 'true') &&
            (!pendingOnly || candidate.dataset.reviewed !== 'true') &&
            (!notesOnly || candidate.dataset.hasNotes === 'true') &&
            (!followUpOnly || candidate.dataset.followUp === 'true') &&
            (!licenses.size || licenses.has(candidate.dataset.license));
          candidate.hidden = !show;
          if (show) visible += 1;
        });
        document.querySelector('[data-visible-count]').textContent = visible;
        document.querySelector('[data-empty]').hidden = visible !== 0;
      };
      const sortCandidates = () => {
        const order = document.querySelector('#review-sort').value;
        const sorted = [...candidates].sort((left, right) => {
          if (order === 'promoted') {
            const promotion = Number(right.dataset.promoted === 'true') - Number(left.dataset.promoted === 'true');
            if (promotion) return promotion;
          }
          if (order === 'license') {
            const license = left.dataset.license.localeCompare(right.dataset.license);
            if (license) return license;
          }
          return left.dataset.name.localeCompare(right.dataset.name);
        });
        const list = document.querySelector('[data-candidate-list]');
        sorted.forEach((candidate) => list.append(candidate));
      };
      const updateCandidateState = (assetId) => {
        const candidate = candidates.find((node) => node.dataset.assetId === assetId);
        if (!candidate) return;
        const review = valueFor(assetId);
        candidate.dataset.reviewed = String(fullyReviewed(review));
        candidate.dataset.hasNotes = String(Boolean((review.notes || '').trim()));
        candidate.dataset.followUp = String(review.followUp === true);
        updateCounts();
        applyFilters();
        save();
      };

      document.addEventListener('change', (event) => {
        const input = event.target;
        if (input.matches('[data-review-field]')) {
          const assetId = input.dataset.assetId;
          state[assetId] = { ...valueFor(assetId), [input.dataset.reviewField]: input.value };
          updateCandidateState(assetId);
          return;
        }
        if (input.matches('[data-review-follow-up]')) {
          const assetId = input.dataset.assetId;
          state[assetId] = { ...valueFor(assetId), followUp: input.checked };
          updateCandidateState(assetId);
          return;
        }
        if (input.matches('#review-sort')) sortCandidates();
        applyFilters();
      });
      document.addEventListener('input', (event) => {
        const input = event.target;
        if (input.matches('[data-review-notes]')) {
          const assetId = input.dataset.assetId;
          state[assetId] = { ...valueFor(assetId), notes: input.value };
          updateCandidateState(assetId);
          return;
        }
        if (input.matches('#candidate-search')) applyFilters();
      });
      document.querySelector('#export-review').addEventListener('click', () => {
        const payload = {
          schemaVersion: 1,
          kind: 'stackrank-dogs-artwork-review-notes',
          generatedAt: new Date().toISOString(),
          source: model.generatedFrom,
          warning: 'Review notes only. This file is not rights approval and does not mutate image-rights.json.',
          candidates: model.assets.map((asset) => ({
            assetId: asset.assetId,
            catalogId: asset.catalogId,
            displayName: asset.displayName,
            promoted: asset.promoted,
            sourcePage: asset.sourcePage,
            sourcePageRevision: asset.revisionId,
            licenseId: asset.licenseId,
            review: valueFor(asset.assetId)
          }))
        };
        const blob = new Blob([JSON.stringify(payload, null, 2) + '\\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'stackrank-dogs-artwork-review-notes.json';
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        status.textContent = 'Review notes exported. The rights ledger is unchanged.';
      });
      document.querySelectorAll('.photo-frame img').forEach((image) => {
        image.addEventListener('error', () => { image.hidden = true; }, { once: true });
      });

      restore();
      sortCandidates();
      updateCounts();
      applyFilters();
    })();
  </script>
</body>
</html>
`;
}

export async function buildDogArtworkReviewReport({
  ledgerPath = path.join(ROOT, "data", "dogs", "image-rights.json"),
  catalogPath = path.join(ROOT, "data", "dogs", "dog-catalog.json"),
  packsPath = path.join(ROOT, "data", "dogs", "packs.json"),
  outPath = DEFAULT_OUT,
} = {}) {
  const [ledger, catalog, packs] = await Promise.all(
    [ledgerPath, catalogPath, packsPath].map(async (filePath) =>
      JSON.parse(await readFile(filePath, "utf8"))),
  );
  const model = buildArtworkReviewModel({ ledger, catalog, packs });
  const html = renderArtworkReviewHtml(model);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  return { outPath, model, bytes: Buffer.byteLength(html) };
}

const isMain = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/build-dog-artwork-review.mjs [--out <path>]");
  } else {
    const result = await buildDogArtworkReviewReport({ outPath: args.out });
    console.log(`Artwork review report: ${result.outPath}`);
    console.log(
      `${result.model.summary.candidates} candidates; ${result.model.summary.promoted} promoted; ${result.bytes} bytes`,
    );
  }
}
