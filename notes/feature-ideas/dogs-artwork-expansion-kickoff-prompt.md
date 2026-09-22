# StackRank Dogs artwork expansion kickoff prompt

Copy everything below into a new Codex task rooted at `/Users/danbretl/src/stackrank`.

---

Act as the primary orchestrator for the next large StackRank Dogs portrait-expansion cohort in:

`/Users/danbretl/src/stackrank`

Your goal is to complete approximately **250 excellent, accepted, integrated breed portraits** for
previously unillustrated selectable Dogs identities. Work autonomously and diligently; do not stop
after research, prompt writing, scaffolding, reference collection, or another small sample. Use
bounded parallel agents when useful for reference research, rights review, scene research, QA, and
integration, but personally review the integrated result and verification evidence.

First read these documents completely, in order:

1. `AGENTS.md`
2. `notes/feature-ideas/dogs-agent-kickoff-prompt.md`
3. `notes/feature-ideas/dogs-product-handoff-2026-09-22.md`
4. `notes/feature-ideas/dogs-artwork-expansion-handoff-2026-09-22.md`
5. `notes/feature-ideas/dogs-launch-plan.md`
6. `notes/testing/dogs-implementation-status.md`
7. `notes/feature-ideas/dogs-field-guide-v2.md`

Then inspect the working tree, current manifests, relevant scripts, tests, reports, and actual image
files before editing. The tree is intentionally dirty. Preserve all existing user work, Books and
cross-domain work, and the unrelated untracked `logo-design-brief/` directory. In particular, the
24-image batch D and its 48 optimized WebPs are complete and verified local work: do not redo,
discard, or overwrite them.

The exact starting point is:

- 1,239 selectable Dogs identities;
- 52 integrated generated portraits;
- 1,187 selectable identities still unillustrated;
- an 825-entry canonical discovery queue with 161 remaining pack-engaged identities first;
- production still has only the original 28 portraits;
- the local 52-portrait state passed 424 Node tests, 24 Deno tests, every validator, and 37 Chrome
  flows, with evidence paths recorded in the handoff.

Use the repository's `imagegen` skill and the built-in image generator. Treat approximately 250 as
the completed cohort target, not a single blind batch. Generate and visually review in subwaves of
20–30, with no more than four independent image calls running concurrently. One image-generation
call should produce one distinct final asset. Maintain a precise machine-readable cohort ledger so
another agent can resume at the exact next identity if the session is interrupted.

Select the cohort by taking all 161 remaining pack-engaged canonical identities first, then the
highest-value canonical long tail needed to reach about 250. Freeze and record the ordered cohort
before generation. Later cohorts must deliberately expand discovery coverage to the 362 selectable
variety, crossbreed, and historical identities not covered by the current canonical-only queue.

For every breed/type:

- obtain and visually inspect one exact, rights-reviewed Wikimedia Commons morphology reference;
- import its stable File-page metadata with the existing safe acquisition script;
- add it to the rights ledger as morphology-reference-only with UI display, public snapshot, and
  raster-export permissions all false;
- research an appropriate scene grounded in documented origin, historic work, native climate, or
  an honestly plausible regional landscape;
- record a one-sentence scene choice and rationale;
- if evidence is weak or culturally complex, use a beautiful neutral natural landscape instead of
  inventing specificity;
- never use flags, costumes, people, landmark cosplay, stereotyped props, breeder/social/stock
  imagery, provenance-free web images, or a search-result thumbnail as the reference.

Every final image must be a premium, mostly photorealistic editorial field portrait: one adult,
breed-typical dog in a natural standing three-quarter pose at dog-eye level; 3:2 landscape; full
body, all four paws, and complete tail crop-safe; accurate morphology and coat; believable anatomy
and ground contact; soft natural light and restrained color. The setting must be appropriate to
that specific breed and visually present, not generic blur. The reference is for morphology and coat
only: demand a wholly new pose, composition, light, and background. No collars, leashes, harnesses,
humans, extra animals, props, text, logos, watermarks, studio/show-ring staging, plastic CGI fur,
aggressive HDR, or anatomical errors.

Maintain scene and composition variety across the cohort. Do not reduce breed-appropriate settings
to repetitive formulas such as every northern dog in snow, every terrier on heather, or every small
companion in the same garden. The images should cohere as one sophisticated StackRank field guide
while each portrait remains specific and memorable.

After each subwave:

- inspect every full-resolution master for breed identity, anatomy, crop safety, and aesthetics;
- generate and visually inspect a contact sheet for repetition, palette drift, or weak scenes;
- reject and regenerate merely average work as well as obvious failures;
- save full-resolution masters only under the existing ignored master path;
- add accountable per-image QA notes and exact reference/prompt metadata to a batch manifest;
- build the 320/960 WebPs and run the focused generated-artwork, licensed-artwork, and discovery
  validators;
- keep purpose gates unchanged.

Use additional dynamically discovered batch files such as
`data/dogs/generated-artwork-batch-e01.json` through `...-e10.json` if that keeps subwaves
reviewable. Integrate through the existing builder instead of hand-editing the compiled manifest.
Refresh coverage, discovery, cache/version data, and tests as required by the pipeline. Add a real
Chrome assertion for at least one newly illustrated breed and inspect the rendered Rank,
comparison, ranking, and detail UI on desktop and phone. Finish with `npm run verify` and report the
exact accepted count, retries/rejections, coverage, test totals, report paths, and remaining next
identity.

Keep StackRank Dogs' broader product contract intact. Preserve Movies routes, keys, payloads,
tables, public links, and mature browser flows. Keep Books working/noindex and do not expand its
scope. Generated portraits remain visibly disclosed and allowed in normal Dogs UI only; public
snapshot artwork and raster export stay false.

Do not commit, push, deploy, upload production artwork, apply database migrations, or change the
production root redirect unless I separately and explicitly authorize that exact action in this
task. Frequent progress updates and durable checkpoints are required. Continue while safe,
meaningful generation, visual review, integration, or verification work remains.

---

