# Dogs portrait cohort F

## Current continuation — September 23, 2026

Dan requested another approximately 100 dogs, superseding the prior F01 stop. **F02 is now live with
25 additional completed portrait/profile pairs: 332 of 1,239, with 907 unfinished hidden identities.**
Product commit `8a5a5c71` is pushed and Vercel READY; 455 Node, 24 Deno, 41 browser and 49 production checks
passed. All 635 protected files and prior 307 portraits/full descriptions/sources remain unchanged.
The new run targets 407 total; 75 pairs remain. F03/F04 preparation continues in isolated staging.
See `notes/testing/dogs-portrait-continuation-100.md` and `data/dogs/portrait-continuation-100.json`
for release evidence, exact ordered selections, source/QA receipts, current holds and lessons.
All 20 E holds remain; F now has five holds/five append-only reserve activations. Existing hidden saved
state and all sharing-purpose restrictions remain intact. This update supersedes historical stop text below.

## Current stop point — September 22, 2026

Dan superseded the original 100-pair request with: finish the current batch or stop around 300 total,
then publish, record progress, and hide unfinished breeds. **F01 delivers 25 completed pairs,
bringing coverage to 307 of 1,239 identities (932 unfinished).** The current session stops here.
Do not continue generation without a new work request. The frozen 100-primary selection is retained
for a possible continuation; its remaining 75 pairs are not an unfinished promise under the revised scope.

Release receipt: 19221e09. Verification and deployment receipts are recorded below.

The main `/dogs` site exposes only the **307 approved portrait + editor-reviewed description pairs**.
Search, discovery, packs, imports, comparisons, ranking, queues, recent entries, statistics, text
exports and new public snapshots use that set. Of 46 source packs, 42 currently contain visible dogs.
All 1,239 source catalog records remain. Existing hidden rankings and queues survive load, sync,
reorder, review, name import and backup/restore, and automatically return when both gates pass in a
future data release. Stored pack progress is not mutated by rendering. Existing immutable public
snapshots are not rewritten. Public-snapshot artwork and raster exports remain denied.

## Baseline, frozen selection and holds

Starting checkout: `e45d6ba4` on `main`. Direct production downloads matched **1,239 selectable source
identities, 282 generated portraits, 282 developed profiles, and 957 unillustrated identities**.
`reports/dogs-generated-artwork/cohort-f/baseline.json` preserves SHA-256s for 584 protected files.
The final preservation receipt confirms all 584 unchanged, plus byte-equivalent JSON records for
all 282 existing portraits, rights rows and developed profiles. The unrelated `logo-design-brief/`
directory was not changed.

`data/dogs/portrait-cohort-f.json` freezes **100 ordered primaries** (75 canonical identities,
25 varieties), 74 ordered reserves, source snapshots and the 20 untouched cohort-E holds.
Selection SHA-256: `0b3022a1a5de921fbc9974032ba105f8660b3b8b5611c902852754896caafc83`.
All 187 varieties, 139 crossbreeds and 36 historical types were considered during discovery.
Recognized varieties offered reliable exact-identity paths. Crossbreeds with insufficient exact
references stayed reserves; historical types were not forced into modern portraits.

Three hash-linked selection amendments preserve the original evidence:

1. American Cocker Spaniel (`VBO:0200038`) held: exact sources did not resolve adult/full-body morphology.
   Reserve 1, Artois Hound (`VBO:0200078`), activated.
2. Artois Hound held: available qualifying sources were juvenile or historical.
   Reserve 2, Auvergne Pointer (`VBO:0200106`), activated and completed in F01.
3. Dutch Smoushond (`VBO:0200467`) held during F02 preparation: only qualifying own-work scene had
   two reclining dogs; other leads were unsuitable. Reserve 3, Briquet Griffon Vendéen
   (`VBO:0200235`), activated but only partly prepared before the stop.

All **20 E holds plus these three F holds** remain visible in their ledgers. Do not repeat the rejected
source chains without new qualifying evidence. E's frozen 250-selection ledger and checks are unchanged.

## Completed F01 and generation accounting

The first five calibrated pairs count among the 25: Rough Collie, Norrbottenspets, Stabijhoun,
Groenendael and Powder Puff Chinese Crested. F01 also includes Smooth Collie, Black Norwegian
Elkhound, Irish Red and White Setter, Miniature American Shepherd, Prague Ratter, Canadian Eskimo
Dog, English Toy Terrier, Irish Terrier, King Charles Spaniel, Parson Russell Terrier, Lakeland
Terrier, Laekenois, Malinois, Tervueren, Hairless Chinese Crested, Russian Toy, Miniature Bull Terrier,
Smooth Fox Terrier, Long-haired Chihuahua and Auvergne Pointer. Exact VBO IDs and source/provenance
records are in the batch and cohort ledgers.

- Released batch: **32 image calls, 31 returned originals, one failed JPEG-input call, 25 accepted
  portraits, five rejected originals, one acceptable but unselected duplicate, seven retries**.
- Five concrete rejections: Powder Puff tail morphology, Laekenois upper margin, Malinois framing,
  Prague Ratter paved urban setting, and English Toy Terrier staged garden architecture.
- Black Elkhound's extra output was unnecessary; the first good output was retained. Avoid speculative rerolls.
- Another **17 calls returned 17 F02 originals before the stop**. None is primary-approved, integrated
  or published. **Session total: 49 calls, 48 outputs; only 25 completed pairs count.**
- Dutch Rough-haired Shepherd's pre-call record was cancelled before submission and is not a call.

Every accepted original was inspected by its worker and independently by the primary at native
resolution, followed by the F01 contact sheet. All masters are native 1536×1024; only builder-created
320/960 WebPs ship. All 25 final descriptions received independent evidence/prose review and primary
reading. Descriptions remain personality-first, with source notes outside customer-facing summaries.
The Auvergne note deliberately avoids an unsupported family-suitability assertion.

## Models, provenance and efficiency lessons

Actual delegated models: **GPT-6 Sol / High** for the three reusable research/editorial/generation
workers, substantive QA and the visibility helper/review work; **GPT-6 Sol / Medium** for the bounded
pipeline audit. No Luna or Astra subagent was used. The root session's precise model/effort was not
disclosed by the runtime and is not invented. The built-in imagegen service does not disclose its
underlying model. No external API/CLI image generator was used. Token/credit totals were unavailable.

Compact disjoint packets, three workers plus the primary, and source/master hashes prevented
cross-packet overwrites. Reference originals, pinned Commons revisions, creator/license chains,
claim-specific primary sources, scene rationales, exact prompts and QA are retained. Reference
purposes are morphology-only, with UI, public snapshot and raster export all false. Generated images
remain disclosed and UI-only.

Lessons to carry forward:

- Pre-log the exact prompt, input hash and start time immediately before each call. The two Rough
  Collie attempts and five F01-a calls lack exact start timestamps; their receipts explicitly preserve
  unknown/bounded timing and separate output mtimes. Narrow validator exceptions are limited to those
  known attempt IDs. Never infer an exact tool time or invent one.
- The tool rejected one JPEG input; pixel-identical PNG compatibility conversions worked. Preserve
  the Commons original/hash and a separate conversion receipt; do not relabel the original source.
- Reserve activation is append-only and ordered. Review adult identity/body visibility before spending
  a call. Name matches and Commons license labels alone are insufficient.
- Specify generous comfortable margins, natural ground, and full tail/paw anatomy. Correct concrete
  defects, not speculative improvements to an already good portrait.
- Run focused ledger validation before integration. Shared rights rows reject packet-only fields,
  require date-only `reviewedAt`, `modifications: ["none"]` for unmodified originals, and accountable
  reviewer labels. Full reference timestamps and local input paths remain in the source packets.
- Profile loading is explicit: `profile-refresh-f.json` is now wired into the builder. Generated batch
  discovery is dynamic; prompt-template allowlisting and reviewer metadata loading are explicit.
- The canonical discovery queue must subtract only canonical rights-covered IDs, not variety rows.
- Visibility is a projection over saved state. Never delete source identities or filter persisted data
  merely because a breed is temporarily hidden. Pure helpers and browser regression cover this.

## Staged continuation — start here next session

Committed checkpoint: `data/dogs/portrait-cohort-f-staging.json`. It records all 17 exact prompts,
source packets, master hashes, dimensions, timings, assignments and pending statuses. It is not a
runtime batch manifest and must not be counted as published work. Native originals and the detailed
research packets remain local and ignored; verify the files exist before resuming on another machine.

- F02-a, seven originals: Landseer `0200810`, Continental Bulldog `0200380`, Soft-coated Wheaten
  Terrier `0200703`, Smooth-haired Chihuahua `0200340`, Tosa `0201357`, Cane Corso `0200712`,
  Presa Canario `0201085`. Papillon `0200382` is prepared but ungenerated.
- F02-b, eight originals: Saarloos Wolfdog `0201158`, East Siberian Laika `0200472`, West Siberian
  Laika `0201416`, Phalène `0200383`, Norwegian Lundehund `0200838`, Kleiner Münsterländer
  `0200775`, Long-haired Dutch Shepherd `0200464`, French Spaniel `0200548`.
- F02-c, two originals: Blue Picardy Spaniel `0200182` and Pont-Audemer Spaniel `0201046`.
  Prepared but ungenerated: Rough-haired Dutch Shepherd `0200465`, Picardy Spaniel `0201019`,
  Majorca Shepherd `0200847`, Ca de Bou `0200845`, Short-haired Dutch Shepherd `0200466`,
  Castro Laboreiro Dog `0200285`.
- Briquet Griffon Vendéen reserve `0200235` has partial exact-reference/FCI research only. Its
  `f02-reserve-03/build-packet.py` is unrun; do not claim its packet or profile approved.

First review the 17 existing masters individually and the corresponding original references; then
peer-review the staged prose and make a contact sheet. Pay special attention to Wheaten tail/coat,
Pont-Audemer framing and Blue Picardy subject scale. No automatic reroll is warranted. Lundehund
polydactyly was not claimed to be countable in the staging image. Cane Corso's source has altered
appendages; the prompt requested the natural FCI features. Independently adjudicate before acceptance.
Read each staged packet's checks rather than assuming preparation is approval.

Commands and release gates:

```sh
node scripts/dog-portrait-cohort.mjs --cohort=f --check
npm run build:dogs:profiles
npm run build:dogs:generated-artwork
npm run build:dogs:artwork-discovery
npm run verify
npm run test:production
```

F has its own validator, leaving E's frozen checks intact. Rebuild source artifacts, add the next
batch to reviewer metadata, bump both app/reviewer data caches, verify old bytes, then perform full
release verification on a stable candidate. Authorized product commits go directly to main;
record production evidence in a separate documentation follow-up commit. No DB migrations, Storage
writes, root redirect changes, Movies/Books changes or edits to `logo-design-brief/` are in scope.

## Verification and publication

Product commit **`19221e09ff176bb2afd90a6f641bfcb49074dbbf`** is pushed to `main` and live.
Vercel deployment **`dpl_BSPUEzBLdn6E9RK2t223KYV9oVkX`** reached **READY** for that exact commit:
`https://stackrank-2akb0r86p-danbretl-2590s-projects.vercel.app`.

- `npm run verify`: **453 Node tests, 24 Deno tests, all validators and 39 Chrome flows passed**.
  Reports: `reports/runs/2026-09-23T045034Z`, `reports/e2e/runs/2026-09-23T045053Z`.
- `npm run test:production`: **44/44 checks passed**.
- All **50 new WebPs** and seven served runtime/data artifacts matched local SHA-256s.
  The production payload has 307 portraits and 307 developed profiles.
- Desktop and phone main-app search, comparisons, ranking and detail were visually inspected.
  Live production main and reviewer descriptions match the compiled profile; the reviewer shows
  the exact F01 prompt and master provenance. Escape closes it without changing ranking data.
  Existing full browser coverage preserves arrows, filtered navigation, flags and unsaved drafts.
- The new regression preserves interleaved hidden rankings and hidden queues through insertion,
  movement, review, reload, backup/restore, export and import; Movies/Books sentinels and pack
  progress remain intact. Missing completion data fails closed while keeping stored state.
- An initial HTTPS push failed with HTTP 400 before updating origin. Retrying the same commit with
  command-local `http.postBuffer=524288000` succeeded; no Git configuration was changed.

Committed receipt: `data/dogs/portrait-cohort-f-release-f01.json`. Detailed byte/browser evidence:
`reports/dogs-generated-artwork/cohort-f/production-f01.json` and `production-browser.json`.
The separate documentation follow-up records publication in the cohort ledger and updates this
handoff, the implementation status, product/artwork handoffs, writing/visual guidance and shared brief.

Live review: https://www.stackrankapp.com/dogs/artwork-review

