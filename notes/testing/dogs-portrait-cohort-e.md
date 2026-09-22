# Dogs portrait cohort E

Updated September 22, 2026. This is the current continuation record; the September 22 product and
artwork handoffs retain the original 52-portrait baseline as historical context.

The user authorized periodic commits and pushes, then explicitly requested visible progress on the
live site. Verified milestones now go to `main`, which Vercel deploys. Database migrations, production
Storage uploads and root routing changes are outside this artwork expansion.

## Current published milestone E06

- Production commit: `64e3a14e`; **189 / 1,239** portraits live, **1,050** unillustrated.
- Cohort delivery: **137 / 250** accepted and integrated. E06 adds **23** from **29 calls**,
  with **4 rejected masters**, **2 failed calls**, and **6 retries**.
- Cumulative: **169 calls**, **161 generated outputs**, **24 rejected masters**, **8 failed calls**,
  **32 retries**. Thirteen frozen identities remain blocked; E06 adds Tobet (weak adult morphology
  evidence) and extinct Saint Johns (historical sources and modern Labrador substitutes excluded).
- Next actionable identity: Shikoku (`VBO:0201225`, ordinal 151).
- Canonical discovery: **688** without ledger rows (**24** pack-engaged, **664** long-tail).
- All 23 full-resolution originals and the contact sheet passed primary review. Rajapalayam and
  Schnauzer were regenerated for roomier framing. All **332** prior WebPs remain byte-identical.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e06-verify.log`, Node report
  `reports/runs/2026-09-22T210711Z`, Chrome report `reports/e2e/runs/2026-09-22T210728Z`.
- Vercel deployment and **35 production smoke checks** passed; eight sampled live variant hashes
  match. Evidence: `reports/dogs-generated-artwork/cohort-e/e06-production-smoke.log` and
  `e06-production-artwork.json`. E05 documentation commit passed both hosted CI checks.

## Earlier published milestone E05

- Production commit: `de53ed31`; **166 / 1,239** portraits live, **1,073** unillustrated.
- Cohort delivery: **114 / 250** accepted and integrated. E05 adds **21** from **21 calls**,
  with **0 rejected masters**, **0 failed calls**, and **0 retries**.
- Cumulative: **140 calls**, **134 generated outputs**, **20 rejected masters**, **6 failed calls**,
  **26 retries**. Eleven frozen identities remain blocked; E05 adds Ecuadorian Hairless Dog,
  Egyptian Sheepdog, extinct English Water Spaniel and Hairless Khala for inadequate adult identity
  evidence or unresolved source chains.
- Next actionable identity: Karst Shepherd Dog (`VBO:0200758`, ordinal 126).
- Canonical discovery: **711** without ledger rows (**47** pack-engaged, **664** long-tail).
- All 21 full-resolution originals and the contact sheet passed primary review, with varied woodland,
  wetland, heath, upland, cerrado and coastal scenes. All **290** prior WebPs remain byte-identical.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e05-verify-final.log`, Node report
  `reports/runs/2026-09-22T201554Z`, Chrome report `reports/e2e/runs/2026-09-22T201612Z`.
- Vercel deployment and **35 production smoke checks** passed; eight sampled live variant hashes
  match. Evidence: `reports/dogs-generated-artwork/cohort-e/e05-production-smoke.log` and
  `e05-production-artwork.json`. Both E04 product and documentation commits passed hosted CI.

## Earlier published milestone E04

- Production commit: `732ebacc`; **145 / 1,239** portraits live, **1,094** unillustrated.
- Cohort delivery: **93 / 250** accepted and integrated. E04 adds **22** from **27 calls**,
  with **5 rejected masters**, **0 failed calls**, and **5 retries**.
- Cumulative: **119 calls**, **113 generated outputs**, **20 rejected masters**, **6 failed calls**,
  **26 retries**. Seven frozen identities remain reference-blocked; E04 adds Bluetick Coonhound,
  generic Cocker Spaniel and Murray River Retriever. No adjacent breed substitutions were made.
- Next actionable identity: Dandie Dinmont Terrier (`VBO:0200429`, ordinal 101).
- Canonical discovery: **732** without ledger rows (**68** pack-engaged, **664** long-tail).
- Primary review inspected all 22 final originals and the contact sheet. Three additional primary
  rejects were regenerated for distant settlements (Shar-Pei/Cirneco) and ambiguous coat/sex (Cimarrón).
  All **246** previously published variants and batch D manifest bytes remain unchanged.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e04-verify-final.log`, Node report
  `reports/runs/2026-09-22T193200Z`, Chrome report `reports/e2e/runs/2026-09-22T193217Z`.
- The E03 hosted checks revealed an iPad test-state regression introduced by the new phone capture:
  the test measured an intentionally hidden Move handle. E04 checks the exact four visible actions
  per row and their 44px targets; the full local suite now passes. No product layout was changed.
- Vercel deployment and **35 production smoke checks** passed, and eight live variant hashes match
  the reviewed manifest. Evidence: `reports/dogs-generated-artwork/cohort-e/e04-production-smoke.log`
  and `e04-production-artwork.json` in the same directory.

## Earlier published milestone E03

- Production commit: `8c199b90`; **123 / 1,239** portraits live, **1,116** identities unillustrated.
- Cohort delivery: **71 / 250** accepted and integrated. E03 adds **23** from **29 calls**,
  with **3 rejected masters**, **3 failed calls**, and **6 retries**.
- Cumulative: **92 calls**, **86 generated outputs**, **15 rejected masters**, **6 failed calls**,
  **21 retries**. The failed Weimaraner call is correctly counted only as a tool failure;
  its earlier rejected-QA label was corrected while preserving the original failure evidence.
- Four frozen identities are reference-blocked. E03 adds Rampur Greyhound (ineligible/weak adult
  sources) and Abyssinian Sand Terrier (only taxidermy/historical reconstruction evidence).
- Next actionable identity: American Hairless Terrier (`VBO:0200049`, ordinal 76).
- Canonical discovery: **754** without ledger rows (**90** pack-engaged, **664** long-tail).
- Primary orchestrator reviewed all 23 full-resolution originals and the E03 contact sheet;
  all **200** previously published variants and batch D manifest bytes remain unchanged.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e03-verify-final.log`, Node report
  `reports/runs/2026-09-22T182509Z`, Chrome report `reports/e2e/runs/2026-09-22T182525Z`.
- Real Chrome now also captures desktop comparison and phone ranking/detail. Primary visual review
  covered Rank, comparison, ranking and detail on desktop and phone; full bodies remain legible,
  cards fit their viewports and disclosure is retained. The phone detail assertion checks image
  loading, horizontal bounds and the generated-artwork disclosure.
- Production deployment and **35 smoke checks** passed; eight sampled live variant hashes match
  the reviewed manifest. Evidence: `reports/dogs-generated-artwork/cohort-e/e03-production-smoke.log`
  and `e03-production-artwork.json` in the same directory.

## Earlier published milestone E02

- Production commit: `699b2521`; **100 / 1,239** portraits live, **1,139** identities unillustrated.
- Cohort delivery: **48 / 250** accepted and integrated. E02 contributes **24** from **29 calls**,
  with **5 rejected outputs**, **5 retries** and **0 failed calls**.
- Cumulative: **63 calls**, **60 generated outputs**, **12 rejected outputs**, **3 failed calls**,
  **15 retries**; **202** frozen identities remain, including **2** reference blockers.
- Koolie (`VBO:0200782`, ordinal 42) joins Cantabrian Water Dog on hold: one source has a prohibited
  breeder watermark; the alternate own-work rescue-dog photo cannot establish exact morphology.
- Next actionable identity: Pharaoh Hound (`VBO:0201016`, ordinal 51). Selection/order remain frozen.
- Canonical discovery: **777** without ledger rows (**113** pack-engaged, **664** long-tail).
- All **152** previously published WebPs and the original batch D manifest are unchanged.
- Primary orchestrator inspected all 24 full-resolution originals and
  `reports/dogs-generated-artwork/cohort-e/e02-contact-sheet.jpg`.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e02-verify.log`, browser evidence
  `reports/e2e/runs/2026-09-22T173936Z`.
- Vercel deployment succeeded; **35 production smoke checks** passed in
  `reports/dogs-generated-artwork/cohort-e/e02-production-smoke.log`. Eight live variant hashes
  passed for German Shepherd, Indian Pariah, Norwegian Elkhound and previously published Beagle;
  record `reports/dogs-generated-artwork/cohort-e/e02-production-artwork.json`.

## Earlier published milestone E01

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
  test; the rerun passed. The subsequent documentation commit also passed hosted CI.

The new Chrome assertion checks exact Swedish Vallhund identity and loaded 320px portrait while
allowing the separately retained Swedish Cattle Dog alias result. Generated portraits remain
disclosed and normal-Dogs-UI-only. Morphology references deny all display/export purposes; generated
public-snapshot artwork and raster export remain false. Movies, Books and `/` → `/movies` are intact.

## Work in progress

E07 has 24 candidates that passed primary full-resolution and contact-sheet review; generic Welsh
Corgi remains held because the catalog separately represents Cardigan and Pembroke identities.
E08-a has nine candidates that passed primary full-resolution review. E08-b generation and E08-c
preparation continue; E09-a has six agent-reviewed candidates, with Phu Quoc, Sapsali and Bully Kutta
held for inadequate exact adult morphology evidence. E09-c reference research is underway.

At the user's request, routine reference/scene preparation, generation bookkeeping and first-pass
QA now use GPT-5.6 Sol at High effort where available. The primary orchestrator retains difficult
identity/provenance decisions, full-resolution acceptance, contact-sheet review and release checks.
An existing stronger-model lane handles bounded reference research while the session's agent limit
prevents another model replacement. Generation remains one distinct asset per built-in call and no
more than four calls concurrently; model routing does not relax quality or provenance gates.

Isolated staging is under `reports/dogs-generated-artwork/cohort-e/eNN-a`, `eNN-b`, `eNN-c`;
merge only reviewed updates into the authoritative ledger. Masters and rejected originals stay
only under ignored `assets/dogs/generated-masters/`.
