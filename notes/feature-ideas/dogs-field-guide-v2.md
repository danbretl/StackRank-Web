# StackRank Dogs field-guide V2

Status: implemented and pushed September 22, 2026 in `254810ae`.

Current portrait expansion: F01 is published in `19221e09`, bringing the field guide
to **307 complete portrait/profile pairs**. The public app now shows completed pairs only; the full
1,239-record source catalog and saved hidden entries remain intact for future completion. See
`notes/testing/dogs-portrait-cohort-f.md` for release evidence and the explicit stop/handoff.
The original 28/52 counts below describe the design's historical launch stages.

## Product direction

Dogs keeps Movies’ mature Rank / Ranking / You skeleton and binary-insertion behavior. Its own
personality comes from what fills that skeleton: large breed names, portrait-led discovery, friendly
field notes, dog-family context, and the feeling of wandering through an unusually broad dog atlas.
The visual direction is “modern field guide,” not pet-store whimsy: warm bone paper, restrained clay
and moss accents, strong black typography, documentary-style landscapes, and generous editorial
spacing.

The September 22 discovery refinement and follow-up keep ranking primary while replacing the
oversized hero. “A few dogs to meet” groups a wide search row, Surprise me, Shuffle dogs, a
highlighted Browse all dogs button and four portraits that begin ranking directly. Recently
ranked and six varied or resumable packs follow. The public gallery browses completed identities
in 24-image pages with full-profile navigation. Pack previews use pictures/names; See all dogs
opens the full pack, and ranking from that view returns to its scroll position. Unranked dogs
precede grayscale ranked dogs. Desktop comparisons show full descriptions and supported size/origin
facts. The whole card chooses a dog except for its image-corner info control; Escape dismisses
About without canceling the comparison. Phones keep both choices in one viewport and disclose
prose in About. Detailed ranking uses authored short descriptions without clipping; Photos shows
portraits and names, and Compact keeps small thumbnails in a dense list. Profile ranking actions
are visually primary. See `dogs-discovery-refinement.md`.

## Content contract

Every currently visible identity has an approved generated portrait, an independently researched
personality-first description, and the supporting fields below. Unfinished source records are retained
but hidden until both image and description pass review. The writing contract in
`dogs-breed-profile-quality.md` supersedes the original brief-profile approach.

Supporting profile fields:

- a full character-first summary and a separately authored short description for condensed UI;
- one interesting fact or honest catalog-context note;
- a human-readable dog-family label;
- provenance and a review tier;
- origin, size, historical roots, registry group, and scoped popularity only when supported.

The original 28 deep-profile breeds have hand-reviewed original copy. Structured source matches may deepen the
remaining profiles, but uncertain entries deliberately say less. Copy must not promise temperament,
trainability, health, allergy safety, child compatibility, or household fit from breed identity.

Dog-family labels follow an explicit hierarchy: cited FCI family for the promoted cohort, then a
curated editorial family, then a VBO catalog class such as breed variety, named crossbreed, or
historical type. A registry-group guess is never generated just to fill a box. Popularity always
names geography, year, source, rank, and denominator.

## Portrait contract

The initial generated cohort contains the 27 promoted starter identities plus Broholmer. A second
24-breed cohort covers every remaining breed appearing in at least three editorial packs, bringing
the current generated set to 52. Each image
uses a rights-reviewed photograph only as a morphology reference, while the prompt requires a new
composition and a cohesive natural field-guide look. The review manifest records breed plausibility,
anatomy, crop, aesthetics, prompt version, timestamps, master hashes, and optimized variant hashes.

Generated portraits are disclosed as illustrations and never presented as photographs of individual
dogs. They are allowed in normal UI only. Public snapshots and raster export remain false until those
purposes receive their own product and disclosure review. The original licensed-photo ledger remains
separate and available as a fail-closed fallback rather than being discarded or silently reclassified.

## Source hierarchy

- VBO 2026-04-15: canonical identity, aliases, and catalog status (CC BY 4.0).
- Wikidata snapshot 2026-09-21: structured country associations (CC0).
- FCI promoted snapshot 2026-09-21: citation-only group and country context.
- StackRank editorial packs: curated discovery-family context.
- StackRank editorial overrides: original reviewed copy for the illustrated cohort.
- AKC 2025 U.S. ranking: three explicitly scoped factual popularity notes; no bulk text reuse.

## Next quality passes

1. Continue expanding the generated portrait cohort in coherent, human-reviewed batches, prioritizing
   the remaining 161 pack-engaged identities rather than filling all 1,239 identities with weak or repetitive art.
2. Replace generated-baseline copy with source-reviewed or editor-reviewed notes, prioritizing dogs
   that appear in packs and user searches.
3. Add deeper size and history evidence only when a stable source can be stored and cited without
   implying that one registry owns the global definition of a breed.
4. Keep Movies parity as the default. Deviate only when dog discovery or responsible breed context
   materially benefits from the difference.
