# Dogs portrait cohort E

Updated September 22, 2026. This is the current continuation record; the September 22 product and
artwork handoffs retain the original 52-portrait baseline as historical context.

The user authorized periodic commits and pushes, then explicitly requested visible progress on the
live site. Verified milestones now go to `main`, which Vercel deploys. Database migrations, production
Storage uploads and root routing changes are outside this artwork expansion.

## Published milestone E01

- Production commit: `37cc0e21` (also publishes the preserved batch D checkpoint `b9fd6532`).
- Live generated portraits: **76 / 1,239**; **1,163** selectable identities remain unillustrated.
- New cohort delivery: **24 / 250** accepted and integrated; original baseline: **52**.
- E01: **34 calls**, **31 generated outputs**, **7 rejected outputs**, **3 failed calls**,
  **10 retries**. Invalid-image failures recovered using same-size PNG encodings of exact references.
- Two Flickr-origin reference chains and their generated outputs were rejected and replaced with
  verified Commons own-work references and fresh generations. Rejected attempts remain accountable.
- Cantabrian Water Dog (`VBO:0200283`, ordinal 14) remains blocked by reference evidence; it was not
  generated. Next actionable identity at this checkpoint is German Shepherd Dog (`VBO:0200577`, 26).
- Canonical discovery: **801** identities without ledger rows, including **137** pack-engaged and
  **664** long-tail identities. The separate 362 selectable variety/crossbreed/historical identities
  remain deliberately outside this canonical queue and require a later supplemental expansion.
- All 104 pre-existing WebP hashes and batch D manifest bytes still match the preserved baseline.

The frozen ordered selection, source digests, exact prompts, all attempts, references, scenes,
per-image visual QA, blockers and next-identity counters are in `data/dogs/portrait-cohort-e.json`.
Selection SHA-256: `2dee8d3221097abe699cba2538d0d1d62da42b505027a81eb117caeb62e1b63c`.
The first 161 are the exact original pack-priority order; the final 89 are selected source-reviewed
canonical long-tail breeds. Do not reselect as the discovery queue shrinks.

## Verification and review

Primary orchestrator inspected all 24 full-resolution masters and the rebuilt contact sheet.
The image builder creates only missing variants and refuses to overwrite differing existing bytes.
Its check mode does not repair output. Regression tests cover preservation and evidence-gated progress.

- `npm run verify`: **432 Node tests, 24 Deno tests, every validator and 37 Chrome flows passed**.
- Node report: `reports/runs/2026-09-22T165028Z`.
- Chrome report and desktop/phone screenshots: `reports/e2e/runs/2026-09-22T165045Z`.
- Full log: `reports/dogs-generated-artwork/cohort-e/e01-verify-final.log`.
- Contact sheet: `reports/dogs-generated-artwork/cohort-e/e01-contact-sheet.jpg`.
- Production smoke: **35 checks passed**, log `reports/dogs-generated-artwork/cohort-e/e01-production-smoke.log`.
- Eight live 320/960 variant hashes verified for Swedish Vallhund, replacement Bedlington and Boxer,
  and batch D Basset Hound; record `reports/dogs-generated-artwork/cohort-e/e01-production-artwork.json`.
- Production Chrome `/dogs?debug=1` visibly shows 76 portraits and the new Swedish Vallhund image.
- Initial hosted CI passed all Dogs tests but timed out in the unchanged Movies Share Studio swipe
  test; the failed job was rerun. Track its result before final handoff.

The new Chrome assertion checks exact Swedish Vallhund identity and loaded 320px portrait while
allowing the separately retained Swedish Cattle Dog alias result. Generated portraits remain
disclosed and normal-Dogs-UI-only. Morphology references deny all display/export purposes; generated
public-snapshot artwork and raster export remain false. Movies, Books and `/` → `/movies` are intact.

## Work in progress

E02 has 24 individually reviewed candidate masters; Koolie is held for exact-source identity.
E03 is in generation/review, with Rampur Greyhound and Abyssinian Sand Terrier held for dependable
reference evidence. Isolated agent staging is under `reports/dogs-generated-artwork/cohort-e/eNN-a`,
`eNN-b`, `eNN-c`; merge only reviewed updates into the authoritative cohort file. Full-resolution
masters and rejected originals stay only under ignored `assets/dogs/generated-masters/`.
