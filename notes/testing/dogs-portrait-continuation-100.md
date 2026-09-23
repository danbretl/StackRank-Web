# Dogs portrait continuation: 100 additional completed pairs

## Current state — September 23, 2026

Dan explicitly requested another approximately 100 dogs after the F01 stop. This supersedes the prior
stop request. Baseline was verified at **307 accepted portraits and individually researched full profiles,
1,239 source identities, 932 unfinished**. The target is **407 completed pairs**, delivered in four waves.
All four milestones are live: **100 new pairs; 407 completed, 832 unfinished**.
**No active pair remains unfinished in this run.**
All unfinished entries remain hidden from normal Dogs UI, with source records and saved state retained.

`data/dogs/portrait-continuation-100.json` freezes the ordered 100 primary identities and 15 additional
ordered reserves. Its digest is `1817c6548fdc677d29731ad42956dac23eb1dcf20f7557612eea3c02a8258af8`.
It reuses F's 75 remaining active selections for F02–F04, then 25 newly assessed G01 identities.
F's original selection and E's frozen evidence remain unchanged; append-only amendments resolve holds.

## F02 publication receipt

- Product commit **`8a5a5c71`**, pushed directly to main. Vercel production deployment
  `dpl_GpnveuAiBjmjwGwTbLKSow3LgUwc` is READY:
  https://stackrank-6so2nugds-danbretl-2590s-projects.vercel.app
- Full `npm run verify`: **455 Node, 24 Deno and 41 Chrome flows passed**; cache and all catalog,
  profile, rights, artwork, discovery and pack checks passed. Browser report:
  `reports/e2e/runs/2026-09-23T074101Z`; verify log: `reports/dogs-generated-artwork/continuation-100/f02-verify.log`.
- Desktop and phone screenshots independently inspected for new Landseer search, comparison,
  ranking and detail; full descriptions and authored short descriptions agree with data.
  Reviewer arrows, Escape, flags and unsaved drafts remain covered by the passing browser flow.
- `npm run test:production`: **49 checks passed**. Thirteen direct production byte comparisons matched:
  both compiled manifests, F02 generation metadata, both runtime consumers, and 320/960 image pairs
  for four new identities. Receipts: `f02-production.log` and `f02-live-receipt.json` in the continuation reports.
- **635 protected files unchanged**, including every prior portrait variant and old batch/profile source.
  All previous 307 artwork records, approved summaries and their sources are unchanged. Receipt:
  `f02-preservation-receipt.json`. New profiles are in explicitly loaded `profile-refresh-f02.json`,
  keeping F01's review dates and source IDs intact.
- Cache versions: Dogs JS52, reviewer JS11, generated manifest15, profiles8, rights21;
  compiled profile version `dogs-field-guide-2026-09-23.1`. Both consumers load matching current data.

F02 reconciles **17 prior-session native outputs plus 14 new image calls**. There are 31 originals,
25 accepted pairs and six rejected originals: old Wheaten coat/tail, Papillon source resemblance,
Briquet tail carriage, Dutch short-haired ear clearance, and two Dutch rough-haired framing failures.
The prelogged cancelled Dutch rough-haired call remains excluded from counts. The 17-output historical
staging receipt is retained; the cohort ledger now records final dispositions. Seven legacy prompt hashes
included the saved text file's trailing newline, omitted by the old JSON field; integration used the exact
pre-call prompt file, verified against its recorded hash, without overwriting historical receipts.

F cumulatively has **63 image calls, 62 originals, one failed call, 11 rejected originals, one unselected
acceptable duplicate, 13 retries, 50 accepted/published pairs** through F02. These totals exclude current
F03/F04 staging until reconciled; attempts never count as completed pairs.

## F03 publication receipt

- Product **`9c804111`**, pushed directly to main; Vercel READY deployment
  `dpl_Gwhh8GViqQGjSfHfTbZQxZmp4kWD`:
  https://stackrank-gvrfoxhq6-danbretl-2590s-projects.vercel.app
- Full `npm run verify`: **455 Node, 24 Deno, 41 Chrome flows passed**. Browser report
  `reports/e2e/runs/2026-09-23T093823Z`; log `continuation-100/f03-verify-final.log` under portrait reports.
  Primary inspected desktop/phone search, comparison, ranking and detail screenshots for Silken Windhound.
  Reviewer arrows, Escape, flags and draft behavior remain covered.
- Production: **49 checks passed**, plus **13 exact byte matches** for compiled manifests, generation
  metadata, consumers and four representative 320/960 portrait pairs; `f03-live-receipt.json`.
- All prior **332** artwork/full-profile/source records and variant bytes unchanged; all **635** baseline
  protected files unchanged (`f03-preservation-receipt.json`).
- F03: **34 actual calls and originals, 25 accepted pairs, nine rejected originals**. One pre-call
  cancellation is excluded. Rejections cover sheep, crop/ear margins, and the Standard Poodle reference
  whose filename implied size without explicit source identification. The replacement uses an explicitly
  identified adult Standard Poodle. Old sources, prompts and originals remain archived.
- F cumulative: **97 calls, 96 originals, one failed call, 20 rejected, one acceptable unselected duplicate,
  22 retries, 75 published pairs**. F04/G01 staging is excluded until reconciled.
- Current caches: Dogs JS54, reviewer12, profiles9, generated manifest16, rights23; profile version `.2`.

F03 lessons: read exact source descriptions rather than inferring variety from a filename. Keep archived
reference-input paths when a replacement becomes active, so old call hashes remain verifiable. Rights
acquisition timestamps must be full ISO values; when only file acquisition metadata survives, record that
basis explicitly. Rights notes must retain the validator's literal “morphology reference” scope. Run the
focused checks before cache/version finalization. F04 review also caught a source described in Spanish as
a Shepherd cross; its image was replaced from an explicit eight-year-old German Shepherd source.

## F04 publication receipt

- Product **`1e500f9b`** pushed; READY deployment `dpl_Bi3ECdQBVZprkvMv17XCDTGJ3RL4`:
  https://stackrank-4fkcx2iqv-danbretl-2590s-projects.vercel.app
- Full verify: **455 Node, 24 Deno, 41 Chrome flows passed** (`f04-verify-release.log`);
  browser run `reports/e2e/runs/2026-09-23T110440Z`. Primary inspected new Beagle-Harrier desktop
  comparison and phone detail/ranking, plus reviewer phone navigation. Both long and short copy match.
- Production: **49 checks and 13 exact live byte matches**, receipts `f04-production.log` and
  `f04-live-receipt.json`. All prior **357** approved records and variants and **635** baseline files
  unchanged (`f04-preservation-receipt.json`).
- **30 calls/originals; 25 accepted pairs; five rejected outputs**: Spanish Hound coat, Bourbonnais
  and Grand Griffon Vendéen framing, Styrian coat/tail and the German Shepherd cross-reference.
  Final German Shepherd uses explicit adult stock-coat own-work reference; all old evidence remains.
- F closes with **127 calls, 126 originals, one failed call, 25 rejected originals, one acceptable
  unselected duplicate, 27 retries, 100 accepted/integrated/published pairs** and five holds.
- Caches: Dogs JS55, reviewer JS13/CSS3, profiles10, generated manifest17, rights24; profile version `.3`.

The first F04 full suite found a real reviewer overflow: an unbroken FCI source URL forced the phone
layout 30px wider. `overflow-wrap:anywhere` on source links fixes it at 390px and 320px. The next full
run passed Dogs but hit an unrelated Movies Share Studio timing failure; focused reproduction passed
and the final full suite passed all41. Movies code is unchanged. Logs and the async-observation-race
investigation remain under `f04-reviewer-fix/`; do not repeatedly run a passing focused test without a
new hypothesis. Rights normalization also corrected CC0 identifiers/versions and attribution before
release; source URLs and copyright facts were retained, with no policy weakening.

## G01 final publication receipt

- Product **`3ab129ae`** pushed directly to main; Vercel READY deployment `dpl_3779n2quU3muT3z9kDrt6HkVkReF`:
  https://stackrank-njx6w5esw-danbretl-2590s-projects.vercel.app
- Final full `npm run verify`: **466 Node, 24 Deno and 41 Chrome flows passed**; log `g01-verify.log`,
  browser report `reports/e2e/runs/2026-09-23T121412Z`. Primary inspected new German Roughhaired Pointer search, comparison,
  ranking and detail on desktop/phone, including full and authored short copy; Brindle Boxer is the
  companion current-wave search fixture. Reviewer arrows, Escape, flags and draft behavior pass.
- Production: **49 checks and 15 exact byte matches**, including the compiled artwork/profiles, both
  consumers, generation metadata and five new 320/960 pairs including the activated Brindle Boxer.
  Receipts: `g01-production.log`, `g01-live-receipt.json`. Final counts are 407 completed and 832 hidden.
- All prior **382** artwork/profile/source records and variant bytes and all **635** original protected
  files unchanged (`g01-preservation-receipt.json`). Normal Dogs UI admits only completed pairs; source
  catalog and saved hidden entries remain intact. No Movies/Books or root redirect change.
- G01: **36 actual calls/originals; 25 accepted pairs; 11 rejected outputs**,
  including two held Grey Elkhound outputs. All native masters were independently viewed at full
  resolution, descriptions reviewed against primary sources, and the amended contact sheet approved.
- Caches: Dogs JS57, reviewer JS14/CSS3, profiles 11, generated manifest 18, rights 26; profile version `.4`.
  G uses its own strict validator and nine new tests; E/F frozen checks remain unchanged.

## Final accounting and release trail

**100 additional accepted portraits and 100 approved full/short description pairs are live.** Total
coverage is **407 of 1,239**, with **832 unfinished entries hidden**; 42 of 46 source packs are visible.
There is no remaining active ID or blocked publication step in this run.

| Wave | Added pairs | Total | Product commit | Documentation follow-up |
| --- | ---: | ---: | --- | --- |
| F02 | 25 | 332 | `8a5a5c71` | `9b303052` |
| F03 | 25 | 357 | `9c804111` | `750fbf82` |
| F04 | 25 | 382 | `1e500f9b` | `b32c0e6c` |
| G01 | 25 | 407 | `3ab129ae` | Commit containing this final receipt |

Independent audit reconciles **114 new built-in calls + 17 earlier staged originals = 131 outputs**:
100 accepted and 31 rejected. There were **101 attempted identities**, including held Grey Elkhound,
so **30 extra attempts beyond one per attempted identity**. This is different from the rejected count
because the held identity's first output also cannot count toward coverage. No call failed during this
run; two pre-call cancellations are excluded. F's one historical failed call belongs to F01, not this run.
All 36 G receipt-file hashes and exact worker-row digests match. Audit:
`reports/dogs-generated-artwork/continuation-100/final-accounting-audit.json`.

The final full suite passed **466 Node + 24 Deno + 41 Chrome checks**, followed by **49 production checks
and 15 exact production byte matches**. Visual inspection used the stable candidate's desktop/phone
screenshots in `2026-09-23T121033Z`; the same unchanged candidate's final full pass is `2026-09-23T121412Z`.
An earlier run found the existing reviewer-label convention missing from new rights metadata; that was
corrected. Another run had one comparison-focus timeout, which passed the focused reproduction and
then the full suite. Preserve `g01-verify-first.log`, `g01-verify-focus-timeout.log`, `g01-focus-repro.log`
and final `g01-verify.log`. If focus timing recurs, inspect actual active element and animation-frame
ordering; do not mask it with longer sleeps or repeatedly run a passing test without a hypothesis.

G also adds two source-reuse regression tests. `sharedMorphologySource` permits only explicit, reviewed
parent/variety reuse of identical source bytes, File revision, original URL, creator identity/source chain
and license. Both records must remain private morphology references with no delivery variants or display,
snapshot or raster purpose. Default duplicate-source rejection remains. Brindle Boxer and Blenheim
Cavalier use this path; old parent rights rows are unchanged. Source and prompt digest corrections retain
original evidence and the reason for each correction, including the held Elkhound normalization receipt.

Live artwork review: https://www.stackrankapp.com/dogs/artwork-review

## Holds, selection decisions and pipeline

All **20 E holds** remain. F now has five holds and five ordered activations, including the original three.
New amendment 4 holds Mountain Cur (`0200914`): exact adult morphology-readable Commons evidence did
not qualify; the separately named Mountain View Cur cannot substitute. Reserve 4 Blue Gascony Griffon
(`0200178`) is activated for F03. Amendment 5 holds long-haired Pyrenean Sheepdog alias (`0201115`),
which duplicates FCI 141 canonical `0200832` already selected in G01; reserve 5 Gascon Saintongeois
(`0200537`) is activated for F04. Do not repeat rejected chains without new evidence.

Bavarian Mountain Scent Hound `0200130` and `0200129` resolve to one FCI 217 breed. Neither was previously
published, and only `0200130` is selected in this run. Keep that frozen representative; do not later
count its catalog alias as a second completed distinct breed. Source evidence remains in F04-a's identity record.

Actual delegated models are **GPT-6 Sol / High** for three reused research/editorial/generation workers.
Root owns final image/prose decisions, ledgers, integration and releases. The root runtime's exact model
configuration and the built-in imagegen model were not disclosed; no model or usage/cost value is invented.
All image calls use built-in imagegen; no separately billed image API/CLI. Reference photos remain
morphology-only with all delivery purposes false. Generated artwork is disclosed and normal-UI-only;
public snapshot artwork and raster export remain denied.

The active site-improvement task completed and released files through `f682a1b1`. Portrait preparation
used `/Users/danbretl/.codex/worktrees/dogs-portraits-f-continuation/stackrank`; only scoped release files
were copied to main after coordination. UI improvements from `610c2eea`, short-description behavior,
Movies/Books routes and isolation, root redirect and unrelated `logo-design-brief/` were preserved.

## Completed-run handoff and current lessons

Completed packets remain in ignored `reports/dogs-generated-artwork/continuation-100/f02-*`, `f03-*`,
`f04-*` and `g01-*`; immutable native outputs remain in `assets/dogs/generated-masters/cohort-f/`
and `cohort-g/`. Never discard rejected or held evidence to make accounting appear cleaner.
All source packets include pinned Commons revisions, creators/licenses/original-chain evidence,
source hashes, morphology/scene rationale, exact prompts and pre-call receipts. Primary image reviews,
profile reviews, contacts and release receipts are in the continuation report root.

- All four waves are published. Next selection starts at 407, after re-verifying the checkout. No pending
  active pair, generation request or publication task remains. Preserve all three cohort freezes.
- G hold 1 rejects Grey Norwegian Elkhound 0200957 as the same breed already published as 0200955.
  Brindle Boxer 0200211 was activated by amendment `6ecd9b337a514d9d8028bc44172945538272c361baa1b069eacd20e7c73e2a42`.
  E 20 + F 5 + G 1 holds remain visible; this run used three reserves. Compare canonical names, aliases and
  registry standards against published coverage before any call; two canonical IDs can still be synonyms.
- Legitimate color varieties can reuse a qualifying morphology source with an identity-specific rights
  namespace, preserving the published parent record. They must not claim coat-specific temperament.
- G source review replaced Harrier/Elkhound public-domain metadata lacking canonical URLs and a
  head-only Cavalier source; old evidence remains. Three tail issues were corrected. Elkhound's later
  identity hold is distinct from image-quality review and does not invalidate the existing portrait.
- Exact submitted prompt strings may omit a saved text file's trailing newline. Store both hashes
  separately; the operator-confirmed Elkhound correction is recorded without changing source receipts.
- A prompt's exclusion list is not an acceptance check: inspect the whole background for extra animals
  and the native top/bottom margins. Prefer dog height about 75–80% of frame and explicit 100px clearance.
  Preserve every rejected native and its concrete reason. Do not reroll a good image speculatively.
- F02 confirmed that authors must supply both personality-first full copy and a distinct short sentence
  (80–150 characters, hard maximum 180) supported by the same claims. Process limitations stay in sources.
- Use supported size enum `toy`, not `tiny`; strip packet-only fields from rights rows. Their review date
  is YYYY-MM-DD, while full source and call timestamps stay in provenance records.
- Use a separate dated profile refresh per new wave and explicitly load it; changing F01's file-level
  review date would needlessly change existing source IDs. Add each batch to the reviewer's explicit list.
- Build the discovery queue after rights integration. Run cache checking after final content edits;
  successful checks update asset fingerprints, so later content changes require another version bump.
- Existing gallery tests now derive total counts from the compiled manifest; current-wave visibility
  fixtures exercise G01 portraits with full and short descriptions. Continue updating representative IDs.
- Preserve native input/output hashes. Compatibility PNG conversions must preserve decoded original
  pixels and retain the licensed original. A prelogged cancelled request is not an image call.

The authorized 100-pair continuation is complete. Future expansion requires a new selection and must
retain every source, identity, editorial, anatomy and publication gate described above.
