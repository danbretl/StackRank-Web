# StackRank Dogs artwork expansion handoff

## Current cohort H — September 23, 2026

H01 is complete and live: **25 additional accepted portrait/profile pairs bring production to 432 of 1,239; 807 unfinished identities remain hidden.** H02 has 18 accepted native portraits and independently reviewed full/short descriptions awaiting integration and release to reach 450.
Product `43fce77b` is pushed and Vercel READY. Full `npm run verify` passed **475 Node tests, 24 Deno tests and 41 Chrome flows**; production passed **49 checks and 15 exact byte comparisons**, including new image variants, descriptions and generation metadata. Desktop and phone Rank, browse/detail, comparison, ranking and artwork-review surfaces were checked. Prior artwork and approved profiles remain unchanged.

H keeps its frozen 43-primary/10-reserve selection and append-only amendment. Smooth Saluki `VBO:0201173` is held: its proposed original duplicates an existing public fallback, and three distinct alternatives failed morphology/readability gates. Ordered reserve Petit Bleu de Gascogne `VBO:0201010` replaces it. **27 holds remain visible: E20, F5, G1, H1.** No historical hold was reopened. H used three reused **gpt-6-sol/high** workers; primary runtime configuration and the built-in image model were not disclosed.

H01 used 29 built-in calls for 25 accepted masters and four quality rejections. H02 has 19 calls, 18 outputs and one failed Hällefors input call followed by a documented compatibility retry; there were no H02 native quality rejections. Continue with H02 only after the H01 documentation follow-up is pushed.
See `notes/testing/dogs-portrait-cohort-h.md` and `data/dogs/portrait-cohort-h.json` for selection, acceptance, publication and next-session details. Evidence and local native masters live under `reports/dogs-generated-artwork/cohort-h/` and `assets/dogs/generated-masters/cohort-h/`.

All 1,239 source records and hidden saved entries remain intact. Generated artwork stays disclosed and permitted only in normal Dogs UI; public-snapshot and raster-export purposes remain false. Movies, Books, the root redirect, database/Storage and concurrent site improvements are preserved. Dan explicitly authorized direct-main commits, pushes and their normal Vercel deployments for this run; historical release prohibitions below are superseded within that scope.

## Historical 100-pair continuation — completed before H

The new 100-pair continuation is complete and live: **100 additional accepted portraits and individually
researched descriptions; 407 of 1,239 overall, with 832 unfinished identities hidden from the main site.**
Final product `3ab129ae` is pushed and Vercel READY. Final full verification passed 466 Node, 24 Deno
and 41 Chrome flows; production passed 49 checks and 15 exact byte comparisons. Previously published
artwork, approved full profiles and sources remain unchanged. All four milestones have production receipts.
See `notes/testing/dogs-portrait-continuation-100.md`, `notes/testing/dogs-portrait-cohort-g.md` and
`data/dogs/portrait-continuation-100.json` for frozen selections, publications and latest lessons.
E retains 20 holds, F retains 5, G retains 1; this run activated three ordered reserves. Grey Norwegian
Elkhound 0200957 is held as a duplicate of already published 0200955, with Brindle Boxer 0200211 replacing
it by append-only G amendment. No active identity remains unfinished in this run. Native outputs and
rejected/held evidence are preserved. Future artwork should start from current 407 coverage and a fresh
cohort (H if unused), verifying checkout counts first; do not rerun this completed selection.
Hidden saved state, normal-UI-only generated artwork, denied snapshot/export purposes, Movies/Books,
root redirect and the concurrent site improvements remain intact. Historical counts below are retained.

## Historical F01 stop — superseded

Snapshot date: **September 22, 2026**

**Latest release — September 22, 2026:** Cohort F01 adds **25 accepted portraits and 25
independently reviewed personality-first descriptions**, for **307 completed pairs**. Product commit
`19221e09` also limits the main Dogs site to those 307 completed identities.
The full 1,239-record catalog is retained; 932 unfinished identities are hidden, with saved rankings,
queues and backups preserved. Completing both gates restores an identity automatically. There are
42 nonempty public packs from 46 source packs. Existing public snapshots are not rewritten; new
snapshots and exports use visible entries. Artwork sharing remains denied.

Dan requested stopping after this batch around 300 total. The original 100-identity F selection stays
frozen for future use; do not start further work without a new request. Seventeen additional native
F02 outputs are staged only, unaccepted and unpublished. Start next session with
`notes/testing/dogs-portrait-cohort-f.md`, `data/dogs/portrait-cohort-f.json` and
`data/dogs/portrait-cohort-f-staging.json`. All 20 E holds remain; three F holds and three ordered
reserve activations are recorded. Prior 282 portraits, rights rows and approved profiles are unchanged.

The 52-portrait sections below are the historical starting snapshot; they do not authorize the old
approximately-250 kickoff or supersede the current stop request.

This document captures the exact continuation state for generating excellent field-guide portraits
for the rest of the selectable Dogs catalog. Read the product handoff first:
`notes/feature-ideas/dogs-product-handoff-2026-09-22.md`.


## Exact state

- Selectable Dogs identities: **1,239**.
- Integrated generated portraits: **52**.
- Identities still lacking generated portraits: **1,187**.
- The current generated manifest has 28 assets reviewed on September 21 and 24 new assets reviewed
  on September 22.
- The current canonical-only discovery queue has **825** entries: 161 pack-engaged and 664 canonical
  long-tail identities. It intentionally excludes all 52 ids that already have a rights-ledger row.
- The discovery queue does **not** yet cover the remaining 362 selectable varieties, crossbreeds,
  and historical types. A comprehensive all-selectable expansion must add a supplemental queue or
  broaden the deterministic builder after the canonical queue is underway.
- At roughly 250 completed portraits per cohort, about five cohorts remain: four near 250 and a
  final near 187. “250” is a delivery target, not one unreviewed generation blast.

## The latest 24-portrait cohort

The latest cohort is integrated in `data/dogs/generated-artwork-batch-d.json`; its optimized assets
are the 48 untracked WebPs under `assets/dogs/generated/`. Do not regenerate, delete, or overwrite
this work.

Every portrait was deliberately placed in a setting related to the breed's documented origin,
historic work, or native climate while avoiding flags, costumes, landmark cosplay, and human props.

| Breed | Deliberate scene direction |
| --- | --- |
| Afghan Hound | Windy highland mountain path |
| Akita | Snow-dusted cedar woodland edge |
| Alaskan Malamute | Snowy boreal clearing with distant mountains |
| Basset Hound | Damp, leaf-strewn country lane and hedgerow |
| Bernese Mountain Dog | Luminous alpine hay meadow |
| Bichon Frise | Warm Mediterranean garden path |
| Border Collie | Upland pasture with dry-stone wall |
| Borzoi | Pale winter meadow and birch trees |
| Cairn Terrier | Scottish heather-and-stone hillside |
| Cardigan Welsh Corgi | Windswept Welsh coastal meadow |
| Chow Chow | Northern Chinese woodland path |
| Doberman Pinscher | Quiet orchard edge at dawn |
| Greyhound | Open English chalk grassland |
| Irish Water Spaniel | Reed-edged Irish lakeshore |
| Irish Wolfhound | Misty Irish moor with distant standing stones |
| Japanese Chin | Moss garden and Japanese maple |
| Komondor | Hungarian grassland at dawn |
| Leonberger | Alpine lakeshore |
| Old English Sheepdog | Misty English pasture and timber gate |
| Pembroke Welsh Corgi | Welsh hillside pasture |
| Portuguese Water Dog | Rocky Portuguese Atlantic cove |
| Samoyed | Snowy birch edge beneath a northern sky |
| Scottish Terrier | Scottish stone path and heather |
| Sloughi | Stony Moroccan plateau with Atlas foothills |

The first 28 portraits also follow the natural field-guide direction and generally use
breed-appropriate environments, but their earliest prompt archival is less consistently detailed
than batch D. Treat batch D as the stronger recordkeeping standard.

## Image quality contract

Each asset should be a premium, mostly photorealistic editorial field portrait. The exact breed
prompt must be individualized, but every generation should enforce:

- one adult, breed-typical dog;
- a natural standing three-quarter pose at dog-eye level;
- 3:2 landscape composition;
- the full body, all four paws, and complete tail safely inside the frame;
- believable breed morphology, joints, face, coat, and tail attachment;
- soft natural daylight, restrained color, tactile fur, and coherent ground contact;
- a wholly new pose, composition, light, and background rather than an edit or reconstruction of
  the morphology reference;
- no people, collars, leashes, harnesses, show-ring furniture, props, text, logos, watermarks, or
  extra animals;
- no studio gloss, hyper-saturation, plastic/CGI fur, aggressive HDR, anatomy errors, clipped feet,
  or fake bokeh that erases the setting.

The image must feel specific to the breed without becoming a stereotype. Choose the setting from
documented origin, traditional work, climate, or an honestly plausible regional landscape. If that
evidence is uncertain or politically/culturally complex, use a beautiful neutral natural setting
suited to the dog's form and coat instead of inventing specificity. Record the setting choice and
one-sentence rationale per breed in the batch data or its preparation ledger.

Scene variety matters across the cohort. Do not put every northern breed in snow, every terrier on
the same moor, or every companion breed in the same garden. The collection should cohere as one
field guide while individual images remain memorable.

## Rights-safe morphology references

Generated portraits do not eliminate provenance discipline. Each breed needs one exact,
rights-reviewed morphology reference before generation.

- Prefer exact Wikimedia Commons File pages with a stable revision and a commercially reusable,
  modification-permitting license accepted by `data/dogs/artwork-license-policy.json`.
- Openverse and Commons search are discovery leads only. Never treat a result thumbnail, search
  listing, breeder page, social post, stock-search result, or unattributed web image as approved.
- Import the exact Commons file and current image metadata with:

  ```sh
  node scripts/fetch-dog-artwork.mjs commons \
    --catalog-id VBO:0000000 \
    --file "File:Exact_Commons_filename.jpg" \
    --out data/dogs/artwork-candidate-example.json
  ```

- Visually inspect the source at useful resolution. Confirm that it plausibly depicts the named
  breed/type and does not itself contain a visible watermark or copyright concern.
- Add the approved source to `data/dogs/image-rights.json` as **morphology-reference-only**. All
  three licensed-photo purposes stay false. The generated asset points to that exact ledger id.
- The prompt must say that the source is a morphology/coat reference only, not an edit target, and
  demand a new setting, pose, composition, and light.

Do not use unlicensed web-search samples merely because image generation is transformative. The
repository's current policy is stricter and intentionally auditable.

## Recommended approximately-250 workflow

Complete one cohort of about 250 previously unillustrated identities, but make it reviewable:

1. **Freeze the cohort.** Start with the 161 remaining pack-engaged canonical identities in
   `data/dogs/artwork-discovery-queue.json`, then add the highest-value canonical long tail to reach
   about 250. Save an explicit ordered cohort manifest before generating.
2. **Prepare references in bounded groups.** Research and import exact Commons candidates; review
   subject and license; record morphology-only ledger rows with every display/export purpose false.
3. **Research each scene.** Use the existing profile's cited origin/history when adequate. Consult
   primary registry or other authoritative sources when it is not. Save a short scene rationale;
   never make an unsupported cultural or behavioral claim.
   For accompanying breed copy, follow `dogs-breed-profile-quality.md`: personality and character
   lead; distinctive skills, habits and history follow. Keep appearance minor in that prose, while
   retaining precise morphology in the separate image prompt. Use `stackrank-dog-profiles` when available.
4. **Generate in subwaves of 20–30.** Within a subwave, up to four independent image-generation
   calls may run concurrently. Use one call per distinct final asset. Persist the full-resolution
   returned original under the gitignored `assets/dogs/generated-masters/` path.
5. **Review every master.** Record separate breed-identity, anatomy, crop, and aesthetics notes.
   Reject and regenerate anything with ambiguous breed identity, malformed feet/legs/tail/teeth,
   fake text, an implausible coat, clipped extremities, weak setting logic, or merely average visual
   quality.
6. **Inspect contact sheets and full size.** Build a contact sheet after every subwave to catch
   repetition and palette drift, then open questionable masters at full resolution. A green script
   cannot substitute for visual review.
7. **Integrate subwave manifests.** Files may use names such as
   `generated-artwork-batch-e01.json` through `generated-artwork-batch-e10.json`; the builder now
   discovers `generated-artwork-batch-*.json` dynamically. Keep one unique asset per catalog id.
8. **Build optimized variants.** Run `npm run build:dogs:generated-artwork`, then validate hashes,
   dimensions, references, QA, and policy with `npm run validate:dogs:generated-artwork` and
   `npm run validate:dogs:artwork`.
9. **Refresh derived artifacts.** Rebuild the discovery queue so completed ids leave the queue;
   update the coverage report and asset/cache versions exactly as the existing pipeline requires.
10. **Exercise the real product.** Add focused tests for new batch discovery and at least one exact
    newly illustrated breed in Chrome. Inspect Rank, comparison, ranking, and detail screenshots at
    desktop and phone widths.
11. **Finish the cohort green.** Run `npm run verify`, inspect its screenshots, and record exact
    counts, reports, failures/retries, and remaining coverage.

Do not stop after selecting sources, writing prompts, or producing another small demo. The cohort
goal is roughly 250 accepted, integrated, visually reviewed portraits. If an external limit ends the
session before that, leave exact machine-readable progress, completed subwaves, and the next
unambiguous starting identity rather than obscuring the shortfall.

## Key files and commands

Data and policy:

- `data/dogs/dog-catalog.json`
- `data/dogs/breed-profiles.json`
- `data/dogs/packs.json`
- `data/dogs/artwork-discovery-queue.json`
- `data/dogs/image-rights.json`
- `data/dogs/artwork-license-policy.json`
- `data/dogs/generated-artwork-policy.json`
- `data/dogs/generated-artwork.json`
- `data/dogs/generated-artwork-batch-{root,a,b,c,d}.json`

Scripts:

- `scripts/fetch-dog-artwork.mjs`
- `scripts/build-dog-artwork-discovery-queue.mjs`
- `scripts/build-generated-dog-artwork.mjs`
- `scripts/validate-dog-artwork.mjs`
- `scripts/validate-generated-dog-artwork.mjs`
- `scripts/prepare-dog-artwork-batch.mjs`
- `scripts/run-e2e-smoke.cjs`

Validation:

```sh
npm run build:dogs:generated-artwork
npm run build:dogs:artwork-discovery
npm run validate:dogs:generated-artwork
npm run validate:dogs:artwork
npm run validate:dogs:artwork-discovery
npm run verify
```

Before using these commands, inspect their current `--help`/source and existing batch manifests.
Do not assume this snapshot supersedes executable contracts.

## Non-negotiable boundaries

- Preserve the dirty working tree and existing 24-image batch D.
- Preserve Movies behavior, Books/noindex behavior, and `logo-design-brief/`.
- Keep generated art visibly disclosed and UI-only.
- Keep public-snapshot artwork and raster export false.
- Do not upload production artwork, commit, push, deploy, apply migrations, or change the root
  redirect without explicit authorization for that distinct action.
