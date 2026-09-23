# Dogs portrait continuation: 100 additional completed pairs

## Current state — September 23, 2026

Dan explicitly requested another approximately 100 dogs after the F01 stop. This supersedes the prior
stop request. Baseline was verified at **307 accepted portraits and individually researched full profiles,
1,239 source identities, 932 unfinished**. The target is **407 completed pairs**, delivered in four waves.
The first milestone is live: **F02 adds 25 pairs; 332 completed, 907 unfinished**. **75 remain** in this run.
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

## Next wave and current lessons

F03 and F04 preparation stays in ignored `reports/dogs-generated-artwork/continuation-100/f03-*` and
`f04-*`; immutable native outputs are in ignored `assets/dogs/generated-masters/cohort-f/`.
All source packets include pinned Commons revisions, creators/licenses/original-chain evidence,
source hashes, morphology/scene rationale, exact prompts and pre-call receipts. Primary image reviews,
profile reviews, contacts and release receipts are in the continuation report root.

- Finish F03 independent native review, source/long-and-short-copy review and whole-wave contact sheet
  before integration. Initial primary review rejected four F03-a originals for background sheep or
  insufficient ear clearance; targeted replacements are staged. No weak output is counted to keep pace.
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
  fixtures exercise F02 portraits with full and short descriptions. Continue updating representative IDs.
- Preserve native input/output hashes. Compatibility PNG conversions must preserve decoded original
  pixels and retain the licensed original. A prelogged cancelled request is not an image call.

Continue through F03, F04 and G01 to the user-authorized total 407, with product and separate documentation
commits at each milestone. Do not stop at F02 or count staged/rejected/held identities as completed.
