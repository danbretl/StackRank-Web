# Scoped portrait corrections — 2026-10-06

The immutable audit's six portrait findings were independently checked against both actual 960px delivery images and unchanged 1536×1024 native masters, alongside primary exact-identity standards. Four findings were rejected; two supported narrower corrections. Full individual decisions are retained with the overall audit-correction evidence.

- VBO:0200271 Campeiro Bulldog: reduce excessive cheek/neck skin. CBKC allows thick hanging lips and a modest dewlap; those features alone are not defects.
- VBO:0200769 King Charles Spaniel, Tricolour: strengthen the characteristic skull dome, deep stop and short upturned muzzle. The prior image did not establish a different breed identity.

Fresh text-only research dossiers and prompt bytes were individually approved by the GPT Astra High lead before each supported built-in image call. No source image was supplied. Both outputs passed separate lead/root native reviews and combined contact-sheet QA. Two calls, zero failed calls, zero retries and no active permit remain. Runtime/image model identifiers were undisclosed; permission profile was workspace-write, not Full access.

## Evidence and preservation

`authorization.json`, the two research dossiers, prompts and hash-named `root-approvals/` records bind the fresh correction scope. The root-recorded Campeiro approval and lead-written King Charles approval were used; the two additional approvals preserve the same reviewer decision but were not additional permits or generation calls.

`preservation-receipt.json` records original, native and private-archive hashes and actual successful restoration probes. The historical native files, old WebPs, source caches, batch records and original tool outputs remain intact. Private native copies/contact sheet are under ignored `debug/dogs/audit-corrections/`; archive restoration copies are in `/tmp/stackrank-audit-root-support/restoration-probe`. Off-Mac backup remains unverified.

The isolated worktree uses ignored per-file symlinks for 900 unchanged historical masters, each hash-checked before linking to the original main or N checkout. The builder only reads those paths. The original checkouts remain necessary to reproduce the artwork locally; do not delete, move or clean them. The complete link receipt remains at `/tmp/stackrank-audit-root-support/native-read-links.json`.

## Additive integration

`data/dogs/generated-artwork-corrections-2026-10-06.json` is the explicit additive input. `scripts/dog-artwork-corrections.mjs` requires one matching historical identity, expected old native path/hash, new non-overwriting native path, fresh text-only scope/approval/prompt binding, independent native/contact-sheet review and denied downstream sharing purposes. Historical batch files are not rewritten. The builder verifies the corrected native bytes, and the generated-artwork validator verifies committed evidence and every delivered variant hash without requiring private masters in CI.

The review page loads this correction document and selects generation metadata by exact native hash. Four superseded WebPs remain tracked but are excluded from `dist/public`; four new versioned files replace them in the runtime manifest. UI artwork remains allowed; public snapshot artwork and raster export remain denied.

Focused regression tests cover stale/ambiguous targets, historical immutability, authority separation, evidence mutation/path escape, required QA, and native-specific review provenance. The separate coordinator tests cover atomic one-call admission, immutable prompt/approval bytes and no duplicate requests. Full final-tree verification and release receipts belong to the overall hand-back.
