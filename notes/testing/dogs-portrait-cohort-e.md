# Dogs portrait cohort E

Updated September 22, 2026. This is the current continuation record; the September 22 product and
artwork handoffs retain the original 52-portrait baseline as historical context.

The user authorized periodic commits and pushes, then explicitly requested visible progress on the
live site. Verified milestones now go to `main`, which Vercel deploys. Database migrations, production
Storage uploads and root routing changes are outside this artwork expansion.

## Final published milestone E10

- Final portrait product commit: `635e54c7`; **282 / 1,239** portraits live (**22.76%**),
  **957** unillustrated. This preserves the original 52 and adds **230 accepted new portraits**.
- All **250 frozen identities** have been reviewed: **230 accepted/integrated**, **20 reference holds**.
  The shortfall from the approximate 250 accepted target is explicit; held identities were neither
  replaced with adjacent breeds nor counted as finished artwork. No actionable selected entry remains.
- E10 adds **23** from **36 calls**, with **11 rejected masters**, **2 failed calls**, **13 retries**.
  PBGV and Polish Tatra remain held; independent second-look review recovered Mioritic and Volpino.
- Final generation accounting: **309 calls = 293 generated outputs + 16 failed calls**;
  **293 outputs = 230 accepted + 63 rejected masters**. **79 calls beyond first attempts** are retries.
- Canonical discovery: **595** without ledger rows (**14** pack-engaged, **581** long-tail), including
  all 20 holds. The **575 other canonical identities** and **362 noncanonical selectable identities**
  make up the rest of the 957 unillustrated entries.
- All 230 native masters and all ten contact sheets passed primary visual review. An independent
  audit verified accepted/rejected copies against original tool outputs, exact reference hashes,
  all 250 frozen identities and the purpose gates. Every native accepted master is 1536×1024.
- The final build has **564 WebP variants**. All **518** variants published before E10 and the
  preserved batch D manifest are byte-identical to their prior versions.
- Final `npm run verify`: **440 Node tests, 24 Deno tests, all validators, 38 Chrome flows passed**.
  Log: `reports/dogs-generated-artwork/cohort-e/e10-verify.log`.
  Node report: `reports/runs/2026-09-22T235503Z`.
  Chrome report/screenshots: `reports/e2e/runs/2026-09-22T235520Z`.
- Vercel deployment succeeded; **44 production checks** and eight exact live image hashes passed.
  Evidence: `reports/dogs-generated-artwork/cohort-e/e10-production-smoke.log` and
  `e10-production-artwork.json`. Both hosted checks passed for the final product commit.
  Root personally inspected the live review page showing all **282** portraits / **12** pages.
- Machine ledger: `data/dogs/portrait-cohort-e.json`. Independent audit snapshot:
  `reports/dogs-generated-artwork/cohort-e/final-audit.json` and `.md` (taken before E09/E10
  integration); the final receipt `completion.json` in that directory records the released totals.
- Final runtime versions: Dogs JS **40**, rights **18**, generated manifest **13**, review JS **3**.
  Morphology reference UI/public/raster purposes remain false. Generated UI display is allowed;
  public snapshots and raster export remain denied. Movies, Books and the production root are intact.

## Earlier published milestone E09

- Production commit: `424d3301`; **259 / 1,239** portraits live, **980** unillustrated.
- Cohort delivery: **207 / 250** accepted and integrated. E09 adds **21** from **29 calls**,
  with **8 rejected masters**, **0 failed calls**, and **8 retries**.
- Cumulative: **273 calls**, **259 generated outputs**, **52 rejected masters**, **14 failed calls**,
  **66 retries**. E09 adds four reference holds: Phu Quoc Ridgeback, Sapsali, Bully Kutta, Telomian.
- Canonical discovery: **618** without ledger rows (**14** pack-engaged, **604** long-tail).
- All 21 original masters and contact sheet passed primary review; all **476** prior WebPs and
  batch D manifest bytes remain unchanged. Packet status aliases and a duplicate Telomian summary
  were normalized without changing hold evidence or frozen identity selection.
- `npm run verify`: **440 Node, 24 Deno, all validators, 38 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e09-verify.log`, Node report
  `reports/runs/2026-09-22T234509Z`, Chrome report `reports/e2e/runs/2026-09-22T234526Z`.
- Vercel deployment, **44 production smoke checks**, and eight live image hashes passed.
  Evidence: `reports/dogs-generated-artwork/cohort-e/e09-production-smoke.log` and
  `e09-production-artwork.json`. E08 product/documentation commits passed hosted CI.
- The live review gallery automatically includes the 259 portraits; metadata list and cache versions
  were advanced with this release. Next actionable frozen entry is Bohemian Shepherd, ordinal 226.

## Earlier published milestone E08

- Production commit: `bff7b132`; **238 / 1,239** portraits live, **1,001** unillustrated.
- Cohort delivery: **186 / 250** accepted and integrated. E08 adds all **25** from **41 calls**,
  with **13 rejected masters**, **3 failed calls**, and **16 retries**.
- Cumulative: **244 calls**, **230 generated outputs**, **44 rejected masters**, **14 failed calls**,
  **58 retries**. Fourteen frozen identities remain held. No new E08 holds.
- Canonical discovery: **639** without ledger rows (**14** pack-engaged, **625** long-tail).
- All 25 original masters and contact sheet passed primary review; all **426** prior WebPs and
  batch D manifest bytes are unchanged.
- `npm run verify`: **440 Node, 24 Deno, all validators, 38 Chrome flows passed**;
  log `reports/dogs-generated-artwork/cohort-e/e08-verify.log`, Node report
  `reports/runs/2026-09-22T233008Z`, Chrome report `reports/e2e/runs/2026-09-22T233025Z`.
- Vercel deployment, **44 production smoke checks**, and eight live image hashes passed.
  Evidence: `reports/dogs-generated-artwork/cohort-e/e08-production-smoke.log` and
  `e08-production-artwork.json`. Root also inspected the live gallery in Chrome.

### Internal artwork review

`/dogs/artwork-review` is unlinked and noindex (not an authenticated private page). It shows all
current generated portraits, 24 per page, searchable by breed/name/alias/id, with a larger image,
field note, generator/date/template/reference, preserved scene/prompt and QA when available.
Unrecorded older metadata and undisclosed image model names are stated as unavailable.
Morphology reference photos are not rendered; only their Commons File-page links appear.

Flags and bounded notes are stored only on this browser in `stackrank:dogs:artwork-review:v1`.
They can be filtered, cleared, or exported to JSON with exact review-time identity/master hash/date.
Changed masters mark old flags stale. Drafts survive closing/reopening within the tab; saving
persists them. Storage failures warn and preserve a tab-only export path. Ranking and account data
are untouched. Desktop/phone, pagination, search, metadata, keyboard focus, save/reload, export,
network health and ranking-key isolation passed a new real-Chrome flow plus seven focused tests.

## Earlier published milestone E07

- Production commit: `95afac08`; **213 / 1,239** portraits live, **1,026** unillustrated.
- Cohort delivery: **161 / 250** accepted and integrated. E07 adds **24** from **34 calls**,
  with **7 rejected masters**, **3 failed calls**, and **10 retries**.
- Cumulative: **203 calls**, **192 generated outputs**, **31 rejected masters**, **11 failed calls**,
  **42 retries**. Fourteen frozen identities remain blocked; E07 adds generic Welsh Corgi, which
  coexists with distinct Cardigan and Pembroke entries and lacks a non-overlapping reference.
- Next actionable identity: Glen of Imaal Terrier (`VBO:0200609`, ordinal 176).
- Canonical discovery: **664** without ledger rows (**14** pack-engaged, **650** long-tail).
  All 161 selected pack-priority identities have now been processed; 147 accepted and 14 held.
- All 24 full-resolution originals and the contact sheet passed primary review. The Giant Schnauzer
  black/silver variety is explicitly supported by current FCI181. All **378** prior WebPs are unchanged.
- `npm run verify`: **432 Node, 24 Deno, all validators, 37 Chrome flows passed**;
  final log `reports/dogs-generated-artwork/cohort-e/e07-verify-final.log`, Node report
  `reports/runs/2026-09-22T214326Z`, Chrome report `reports/e2e/runs/2026-09-22T214343Z`.
  The first full run hit an intermittent unchanged Movies lightbox preview-sync assertion. A focused
  rerun and then the complete suite passed without code changes; original evidence remains in
  `e07-verify.log` and `e07-share-studio-recheck.log`. This does not claim the intermittent issue fixed.
- Vercel deployment and **35 production smoke checks** passed; eight sampled live variant hashes
  match. Evidence: `reports/dogs-generated-artwork/cohort-e/e07-production-smoke.log` and
  `e07-production-artwork.json`. Both E06 product and documentation commits passed hosted CI.

## Earlier published milestone E06

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

## E01 verification and review (historical)

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

## Completion and continuation

All ten selected subwaves are released. No generation, visual review, integration or release work
remains for the 230 accepted identities. The earliest unresolved selected identity is **Cantabrian
Water Dog (`VBO:0200283`, ordinal 14)**; `nextActionableIdentity` is null because all remaining
selected identities are reference-held. A hold may reopen only with new qualifying evidence.

The first unselected entry in the raw canonical discovery order is **Aberdeen Terrier
(`VBO:0200000`, current queue rank 15)**. It is a discovery lead, not a preapproved next generation;
resolve identity overlap before freezing another cohort. The next cohort should deliberately expand
the 362 selectable variety/crossbreed/historical identities omitted from canonical-only discovery,
then freeze its selection without changing cohort E. Keep all 20 E holds visible.

The live `/dogs/artwork-review` tool is available for user review. Flags/notes remain local until
exported; receiving a JSON export does not automatically approve a source or a replacement image.
Future batch releases must update the review page's batch metadata list and matching cache versions
alongside the main Dogs page, then run the browser/provenance/production checks.

At the user's request, routine reference/scene preparation, generation bookkeeping and first-pass
QA used GPT-5.6 Sol at High effort where available. The primary orchestrator retained difficult
identity/provenance decisions, full-resolution acceptance, contact-sheet review and release checks.
An existing stronger-model lane handled bounded reference research and independent final auditing.
One built-in call produced one asset, with no more than four calls concurrently. Exact image model
names are not exposed by the built-in tool and were not invented in generation metadata.

Isolated staging and rejected-candidate evidence remain under
`reports/dogs-generated-artwork/cohort-e/eNN-a`, `eNN-b`, `eNN-c`; accepted and rejected native
masters remain under ignored `assets/dogs/generated-masters/`. Shared ledgers retain exact prompts,
reference hashes, source links, attempts, scene rationales, QA and integration verification.

### Twenty retained reference holds

| Ordinal / identity | Reason | Evidence packet |
|---|---|---|
| 14 · Cantabrian Water Dog (VBO:0200283) | Watermark, disputed subject identification, or unresolved third-party licensing chain. | [e01-b](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e01-b/cohort-updates.json) |
| 42 · Koolie (VBO:0200782) | Breeder-watermarked strong candidate; alternate rescue-dog identity uncertain. | [e02-b](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e02-b/cohort-updates.json) |
| 55 · Rampur Greyhound (VBO:0201123) | Modern adult source blocked by ambiguous public-domain metadata; remaining material historical. | [e03-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e03-a/cohort-updates.json) |
| 73 · Abyssinian Sand Terrier (VBO:0200002) | Only taxidermy/historical evidence; no dependable living-adult morphology anchor. | [e03-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e03-c/cohort-updates.json) |
| 86 · Bluetick Coonhound (VBO:0200183) | Clean candidates fail creator/license checks; stronger alternatives have prohibited social origin. | [e04-b](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e04-b/cohort-updates.json) |
| 98 · Cocker Spaniel (VBO:0200372) | Unspecified Cocker identity overlaps separately cataloged American and English breeds. | [e04-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e04-c/cohort-updates.json) |
| 99 · Curly Coated Murray River Retriever (VBO:0200396) | Whole-adult Murray morphology obscured by motion, shadow, low detail or group context. | [e04-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e04-c/cohort-updates.json) |
| 105 · Ecuadorian Hairless Dog (VBO:0200475) | Adult proportions and natural tail unresolved; one candidate appears juvenile. | [e05-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e05-a/cohort-updates.json) |
| 106 · Egyptian Sheepdog (VBO:0200476) | Tiny source has unresolved prior TrainPetDog.org origin chain. | [e05-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e05-a/cohort-updates.json) |
| 109 · English Water Spaniel (VBO:0200500) | Extinct identity; historical art/scans lack a qualifying resolved reference route. | [e05-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e05-a/cohort-updates.json) |
| 120 · Hairless Khala (VBO:0200650) | Exact Khala identity and adult standing/tail morphology unresolved; Pila is a different type. | [e05-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e05-c/cohort-updates.json) |
| 127 · Kazakhski Tobet (VBO:0007991) | Tobet reference has cropped ears, short tail and unresolved older origin chain. | [e06-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e06-a/cohort-updates.json) |
| 146 · Saint John's Water Dog (VBO:0201166) | Historic source blocked by ambiguous license; alternatives are breeder-origin, Labrador or mix. | [e06-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e06-c/cohort-updates.json) |
| 158 · Welsh Corgi (VBO:0201406) | Unspecified Welsh Corgi cannot silently become Cardigan or Pembroke. | [e07-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e07-a/cohort-updates.json) |
| 201 · Phu Quoc Ridgeback (VBO:0201017) | Available views do not jointly establish clear adult body, ridge and tail. | [e09-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e09-a/cohort-updates.json) |
| 203 · Sapsali (VBO:0201176) | Seated/shaggy reference leaves standing anatomy unresolved; stronger alternatives are Flickr. | [e09-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e09-a/cohort-updates.json) |
| 207 · Bully Kutta (VBO:0200262) | Dyed coat or cropped ears/obscured limbs; another source has Facebook origin. | [e09-a](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e09-a/cohort-updates.json) |
| 213 · Telomian (VBO:0201341) | Exact Telomian photo is Flickr; own-work alternatives are explicitly unidentified/lookalike dogs. | [e09-b](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e09-b/cohort-updates.json) |
| 243 · Petit Basset Griffon Vendeen (VBO:0201009) | Full adult morphology still obscured or soft; independent second look upheld hold. | [e10-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e10-c/cohort-updates.json) |
| 244 · Polish Tatra Sheepdog (VBO:0201037) | Tail/feet, stance, exposure or license limitations; independent second look upheld hold. | [e10-c](/Users/danbretl/src/stackrank/reports/dogs-generated-artwork/cohort-e/e10-c/cohort-updates.json) |
