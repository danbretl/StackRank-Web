# Dogs editorial identity and metadata policy

Adopted October 6, 2026 for the independent audit correction. Domestic breeds, varieties,
regional working populations, historically evidenced types and named crosses can qualify.
Recognition by one particular registry is neither necessary nor sufficient. Registry disagreements
must be attributed to the relevant scheme. A broad family is useful only when it describes a
meaningful population beyond a redundant collection of already available specific breeds; its
profile and label must state that scope. A representative portrait never proves uniformity.

## Visibility and stable identities

`catalog-overrides.json` may carry an `editorialVisibility` decision with `status: suppressed`,
a specific reason and a review date. The catalog compiler preserves the entity, stable ID,
`sourceIds`, relationships and `selectable: true`, and emits a separate editorial visibility flag.
`completedDogCatalogIds` requires both existing completion gates and absence of suppression.
The flag does not falsify prior copy/artwork approval. Suppression is reversible by removing the
authored decision after evidence review and rebuilding.

Discovery, comparisons, visible ranking slots, packs, newly published snapshots and public text
exports use the public projection. Full local/account ranking and queue payloads, timestamps,
comparison counts and JSON backups retain every saved ID. Reorder changes only visible slots.
No new alias identity remapping, ID merging or ranking deduplication is introduced. Previously
published read-only snapshots remain historical user snapshots; they are not rewritten or revoked.
The internal artwork reviewer retains suppressed art and its provenance for inspection.

Unresolved exact identities, non-domestic wild species, placeholders, redundant identity synonyms
and entries without sufficient evidence for a useful accurate field note stay out of new public
selection. Suppression is a product decision, not a claim that the named animal never existed.

## Crosses and evidence

Individual rescue, keeper or therapy accounts may be accurate about that animal. They do not
establish tendencies, suitability, size, coat or predictability for its cross. A useful profile
needs supported parentage and specific history, population or working context; claims about a
particular breeding program are explicitly scoped. Parent-breed traits are not inherited guarantees.
When evidence supports only a name and a single anecdote, retain the research and suppress the
card pending adequate evidence instead of filling the description with boilerplate.

## Display names and aliases

Raw catalog synonyms remain searchable and historically traceable. Optional `displayAliases`
are a separate curated list; an empty list intentionally shows none. Unsupported fragments,
misspellings, generic labels and misleading behavioral epithets are omitted from display. The
“Nanny Dog” epithet is not displayed as child-safety reassurance. Legitimate historical names can
remain when the exact identity is established. A shared nickname receives no exclusive identity
ownership: discovery search can return multiple named cards for explicit user choice. No saved
identity is remapped by a display-alias correction. A demonstrably wrong search synonym may be
excluded individually while retaining the source ontology and stable identity history.

## Origin and registry scope

Authored `originRegions` takes precedence, including an intentional empty array. `originBasis:
registry` means a cited FCI country-of-origin field and is displayed as “Registry origin (FCI)”.
Historical/geographic roots remain separate prose or `historicalRoots`; the registry field is not
an exclusive historical or political judgment. Without authored origins, the compiler takes the
FCI country alone, then authored catalog origins, then a unique structured match. It never unions
FCI country with every Wikidata historical/geographic value. Known equivalent country names are
normalized; ancient states and continent-only labels are not guessed into modern countries.
An absent optional origin is omitted, never filled by scraping a country word from the summary.

## Families and size

Editorial families are a controlled vocabulary of working or type groupings, not biological
clades or a universal registry taxonomy. The compiler folds explicit synonyms such as scenthound /
scent hound and herding / herding dog; geographic heritage, coat, size and pack utility tags remain
in authoring history but do not become families or taste signals. FCI group labels are attributed
as registry groups, with the molossoid portion of Group 2 retained. AKC Non-Sporting is not an
editorial family. A generic fallback says “Breed or regional type”, without implying recognition.

Size is a coarse editorial description of typical adult overall size, using documented mass,
stature and build together. It is not a standard measurement or a health/feeding recommendation.
Toy means the very small, light-bodied end of the companion range; small means compact and light;
medium means intermediate overall size; large means substantial adult size; giant means exceptional
mass or stature together with substantial build. A tall lean hound and a short heavy basset need
not share a height-derived class. Registry “Toy Group” or a variety called “Medium” does not by
itself determine the size band. There are no universal numeric cutoffs: source-specific wording
and measurements must be recorded, related varieties sharing the same standard must be consistent,
and unsupported claims use `unknown` (omitted in UI). `varies` covers deliberately multiple size
classes or heterogeneous crosses, not merely ordinary individual variation.

This correction adjudicates the 35 specifically questioned size records and related consistency
cases. It does not claim new measured weight data for every historical catalog entry. Exact evidence
and known uncertainty are in the correction ledger, retained separately from the immutable audit.
