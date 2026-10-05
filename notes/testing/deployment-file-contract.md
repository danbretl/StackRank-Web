# Deployment file contract

Adopted October 2026. Replaces the ignore-list-only publication model described in
`deployment-output-exclusions.md` (kept as history). Implementation hand-back and release
evidence: `deployment-file-contract-handoff.md`.

## What it guarantees

Vercel no longer publishes the repository root. Its build runs `node deploy/build.mjs
--build-dir dist --inputs git` and serves only `dist/public`, which contains exactly the files the contract
resolves. A build fails, before anything is written, when:

- a referenced or manifest-declared file is missing, untracked, a symlink, escaping the repository,
  non-portable, or colliding with another destination on case-insensitive/Unicode-normalizing
  file systems;
- a public module contains a **recognized** local-path template literal the declaration does not acknowledge (the scanner boundaries below apply);
- an excluded file (authoring record, note, test, script, assistant file…) becomes reachable;
- a declaration entry is stale (rule matches nothing, family anchor no longer public, acknowledged
  literal gone);
- the build directory is unsafe (source root or ancestor, contains tracked files, overlaps a public
  source directory, is a symlink, or is a non-empty directory the builder did not create).

In both CI and Vercel, Git metadata is required and every tracked path must be classified: included
by the closure or excluded by a reasoned rule. Missing/unusable Git metadata stops the build before
output is replaced. A new unclassified tracked file fails with the path and the fix.

## Files

| Path | Purpose |
| --- | --- |
| `deploy/public-files.json` | The declaration: entries, dynamic families, acknowledged constructions, non-file literals, platform paths, opaque modules, exclusion rules. Every item has a reason. |
| `deploy/contract.mjs` | Discovery, resolution, classification, inventory, safe staging, output verification and the current-ignore model. Node built-ins only. |
| `deploy/build.mjs` | CLI. Default builds `dist/public` + `dist/contract/*.json`; `--check` performs two clean builds in temporary directories and records determinism/source-preservation evidence under `reports/deployment-contract/`. |
| `tests/deploy-contract.test.js` | Fixture-tree regression tests plus real-repository assertions. |
| `scripts/run-e2e-smoke.cjs --serve-root=dist/public` | Browser suite against the staged artifact (fixtures/reports still read from source). |
| `scripts/check-production-contract.mjs` | Read-only production comparison against the local Git inventory. |
| `deploy/production-response.mjs` / `tests/production-response.test.js` | Response byte evidence, HEAD-to-GET fallback, and focused regression tests. |

`deploy/` is outside `.vercelignore` on purpose: the Vercel build needs it. It is excluded from the
public output by the contract itself.

## Declaration model

- **entries** — documents and root files served directly or through `vercel.json` rewrites
  (Movies `index.html`/`shared.html`, Dogs `dogs.html`/`dogs-shared.html`/`dogs-artwork-review.html`,
  Books, privacy, the noindex family home, robots, sitemap). Each has a `product` used for
  per-product reporting. A document linked from another page must itself be an entry.
- **Static discovery** — HTML `src`/`href`/`srcset`/`poster`/URL-valued `content` and inline
  `url()`; CSS `url()`/`@import`; JS static, side-effect and literal dynamic imports (resolved
  against the module URL) plus quoted path-like literals with web-asset extensions (resolved
  against every URL that serves a document loading the module — `servingPathsFor`); sitemap `<loc>`
  and robots `Sitemap:`. URLs go through WHATWG URL resolution (so `..` clamps at the site root,
  query strings and fragments drop), `siteOrigins` map same-origin absolute URLs, and `vercel.json`
  rewrites/redirects map routes to files. External origins are recorded, never fetched or copied.
- **families** — `json-manifest` (select items from a public manifest; each URL must match
  `pathPattern`, be a normalized repo path, exist, and match the manifest's bytes/SHA-256) and
  `sequence` (a template expanded over a numeric range, anchored to the exact template literal that
  builds it). Current families: `dogs-generated-portraits` (1,604 WebPs from
  `data/dogs/generated-artwork.json`) and `artwork-review-e-series-batches`
  (`generated-artwork-batch-e01…e10.json`). The other 168 review batches are literal URLs in
  `dogs-artwork-review.js`.
- **acknowledgedConstructions / nonFileLiterals** — template literals and quoted strings that look
  like paths but are routes, identifiers or download filenames.
- **platformPaths** — `/_vercel/insights/script.js` (Vercel Web Analytics).
- **opaqueModules** — the vendored Supabase bundle is shipped as-is and not scanned.
- **excluded** — glob rules (`*` within a segment, `**` across) with `class` and `reason`;
  `guard: true` rules may match nothing (for untracked workspaces or build output).

### Discovery boundaries and author obligations

Regex scanning is not a JavaScript parser, evaluator, or complete inventory of network requests.
The template check recognizes single-line, non-nested templates with a local static prefix
(e.g. `/data/${id}.json`) or a supported asset-extension suffix (e.g. `${base}${name}.json`).
It does **not** resolve variables or concatenation. `${base}/${name}`, multiline/nested templates,
and extensionless bare names such as `fetch("settings")` can evade discovery. Quoted paths inside
comments can count as references, and declared opaque modules are not scanned at all.
The focused extraction tests record these boundaries; they do not certify arbitrary JavaScript.

For every new or changed computed local request, reviewers must enumerate its possible files:
use a public JSON manifest and `json-manifest` family for data-driven URLs, a `sequence` family
anchored to an exact recognized template for bounded series, or explicit entries for fixed files.
Merely acknowledging a construction does **not** add its dependencies. For constructs the scanner
cannot recognize, use a manifest family or fixed entries; an acknowledgement is not a substitute.
Add a focused consumer test and run the staged suite for both Movies and Dogs. Browser tests only
cover exercised paths, so a green scan plus a green suite does not prove every runtime URL exists.
Current Dogs portrait and review-batch families are explicit; this hardening changes no runtime
URLs or canonical content.

## Inputs, determinism and safety

- Git mode is the default for the CLI and planning/build APIs. It reads candidates from the index
  (`git ls-files -s`): tracked files plus anything explicitly `git add`-ed. Untracked, ignored and
  generated files are never inputs; referencing an untracked file fails with `untracked-reference`.
  Vercel explicitly passes `--inputs git`; the CLI also rejects `auto`/`filesystem` overrides when
  `VERCEL=1` or `VERCEL_ENV=production`. There is no silent hosted fallback. The production checker
  likewise requires Git. Git-unavailable fixtures verify failure before source/output mutation.
- Explicit `--inputs filesystem` or `--inputs auto` remains available only for local diagnostics;
  filesystem inputs cannot classify the tree (reported as `not-run`) and are not release evidence.
  If a host loses Git metadata, fix its checkout/build setup instead of switching production modes.
- Reports in `dist/contract/` and the `--check` evidence are sorted, POSIX-relative, and free of
  timestamps/environment data; volatile metadata is isolated in `dist/build-info.json` and
  `check-evidence.json`. `contractDigest` is the SHA-256 of the sorted `path\tbytes\tsha256` lines.
- The builder validates everything before deleting or writing. It only replaces a build directory
  that carries `dist/.stackrank-deploy-output`, copies with exclusive create, sets mode 0644, and
  re-verifies the staged tree against the inventory (missing, extra, altered or linked files fail).
- Path portability: public paths are limited to `A-Z a-z 0-9 . _ @ + -` and `/`; case/NFC
  collisions are rejected on every platform. Fixture tests cannot create case-only collisions on
  case-insensitive macOS volumes, so that case is covered by the pure collision function.

## Commands

```sh
npm run build:deploy        # dist/public + dist/contract reports
npm run check:deploy        # double build, determinism + source preservation evidence
npm run test:e2e:staged     # build, then the full browser suite against dist/public
node --test tests/deploy-contract.test.js tests/production-response.test.js
node scripts/check-production-contract.mjs [--full]   # after a deployment
```

`npm run verify` runs `check:deploy` and `test:e2e:staged` (replacing the source-root E2E run).
`npm run test:e2e` still serves the source checkout for quick local iteration.

## Production byte evidence

The default production checker hashes all non-portrait files and a portrait sample; other portraits
must return 200 with an exact, valid `Content-Length`. Missing or malformed lengths trigger a
rate-limited GET through the same mitigation-aware request path; the body must match both the
inventory byte count and SHA-256. A mismatching valid length fails. GET fallback status, MIME and
cache headers are checked using the final response, and request errors/mitigation still fail or
block the run. `hashed` counts completed GET checks (including mismatches); `headFallbackHashed` counts
completed fallback GET checks, and `headChecked` counts files left in HEAD mode; failure totals determine success.
A HEAD length match is weaker than byte equality (same-length corruption is not detected); use
`--full` for every-file hashing after deployment when that stronger evidence is needed. These
changes are tested with synthetic responses, not a bulk production crawl.

## Changing the public site

- New runtime file referenced by a supported static literal: nothing to declare; commit it (or `git add` it while
  iterating) and the closure picks it up.
- New page: add an entry with product and reason; add its rewrite to `vercel.json`.
- New manifest-driven or constructed URLs: add/extend a family, anchored to the manifest or the
  exact template literal.
- New non-public tracked file: add or extend an exclusion rule with a class and reason.
- Changing `.vercelignore`: it now only trims the Vercel build source; `tests/deploy-contract.test.js` asserts it
  keeps `deploy/` and every public input.
