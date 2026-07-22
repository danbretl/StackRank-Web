# Dogs catalog editorial audit — 2026-07-21

This is the accountable editorial audit for the generated Dogs catalog review queues. It uses the
pinned VBO 2026-04-15 artifact as the identity source and current official registry pages only to
resolve names that the ontology keeps as separate concepts. It does not treat any registry as a
universal recognition authority.

## Coverage and method

The original 682 review rows were recomputed from the pinned 40,044,828-byte VBO artifact. The audit
also compared every selectable VBO term's exact source names before runtime alias suppression. That
second pass found identity collisions and source-format rows that the original runtime-name review
could not expose. After applying the evidence-backed corrections below, the review workspace has
698 traceable rows:

- 294 aliases: 68 VBO exact-name/reciprocal-synonym clusters and 226 explicit overrides;
- 187 varieties: 166 VBO nested concepts and 21 explicit registry/country decisions;
- 139 crossbreeds: 138 are VBO descendants of `VBO:0200902` (Mixed Breed), and generic Wolfdog is
  an explicit consumer-type correction under that same parent;
- 36 historical concepts: every row remains an explicit override after checking its pinned label,
  synonyms, provenance, and relationship context; this is a catalog status, not a claim about
  universal registry recognition;
- 4 exclusions: Jackal, Wolf, the Navasota research population, and one organization name
  misreported as a breed;
- 20 remaining FAO regional/landrace candidates, each retaining the source country and exact VBO
  provenance after six duplicate or malformed regional rows were resolved;
- 18 deliberately ambiguous runtime search names, each still resolving to all of its explicit
  canonical owners rather than silently choosing one.

The compiler and validator still account for all 1,537 source descendants exactly once. The runtime
now contains 1,239 selectable concepts: 877 canonical, 187 varieties, 139 crossbreeds, and 36
historical concepts. The wording pass rejects C1-control mojibake, placeholders, organization names,
registry group labels, and `Old Format` source records from public display identities.

## Evidence map for every override changed in this audit

Every path below is relative to `data/dogs/catalog-overrides.json`. VBO links resolve to the pinned
source identity; registry links are the primary nomenclature or breed pages checked on 2026-07-21.

| Override path(s) | Decision and primary evidence |
| --- | --- |
| `classification.decisions.VBO:0008001`, `classification.decisions.VBO:0008002` | Collapse the FAO Bangladesh spellings “Elsesian” and “German Shephard” into German Shepherd Dog (`VBO:0200577`). The VBO records identify FAO DAD-IS as their source; [FCI 166](https://www.fci.be/EN/nomenclature/BERGER-ALLEMAND-166.html) names the breed German Shepherd Dog, and the pinned target preserves Alsatian as an exact synonym. |
| `classification.decisions.VBO:0008051`, `classification.decisions.VBO:0008059.targetId`, `entities.VBO:0200679` | Use `VBO:0200679` as the Transylvanian Hound identity, with the FAO country spellings “Hungarian houn” and “Transylvanian kopó” as aliases. [FCI 241](https://www.fci.be/EN/nomenclature/CHIEN-COURANT-DE-TRANSYLVANIE-241.html) gives the same breed as “Hungarian Hound - Transylvanian Scent Hound” / Erdélyi Kopó; the consumer display name remains Transylvanian Hound. |
| `classification.decisions.VBO:0008055` | Exclude the FAO row whose label is the name of an organization, not a breed. The [organization's own structure page](https://drotszorumagyarvizsla.hu/szervezeti-felepites/) identifies “Magyarországi Drótszőrű Magyarvizsla Tenyésztők Egyesülete” as an association with officers, committees, address, and tax number. |
| `classification.decisions.VBO:0008085` | Collapse “Kars Turkish Shepherd, Turkey” into the pinned VBO Kars concept (`VBO:0200757`). Both exact VBO records denote Kars and the country row's primary source is [FAO DAD-IS](https://www.fao.org/dad-is). No broader Turkish shepherd identity is inferred. |
| `classification.decisions.VBO:0008087` | Collapse “Çatal Burun Hunting, Turkey” into pinned `VBO:0201464`, whose exact synonyms include Çatalburun and whose source records the Tarsus çatalburun identity. The country row's primary source is [FAO DAD-IS](https://www.fao.org/dad-is). |
| `classification.decisions.VBO:0200155` | Make Berger de Beauce a searchable alias of Beauceron (`VBO:0200136`). [FCI 44](https://www.fci.be/en/nomenclature/BEAUCE-SHEEPDOG-44.html) presents Berger de Beauce and Beauceron names on one breed standard; the target also carries current AKC/Kennel Club/UKC sources. |
| `classification.decisions.VBO:0200198`, `classification.decisions.VBO:0200200` | Collapse two Bosnian Barak source names into `VBO:0200117`. [FCI 155](https://www.fci.be/en/nomenclature/BOSNIAN-BROKEN-HAIRED-HOUND-CALLED-BARAK-155.html) gives Bosanski Ostrodlaki Gonic-Barak and Bosnian Broken-Haired Hound - Called Barak as one breed; the target carries the UKC Barak source. This does not merge the separately sourced Bulgarian Barak. |
| `classification.decisions.VBO:0200296` | Collapse Castro Laboreiro Dog into Cão de Castro Laboreiro (`VBO:0200285`). [FCI 170](https://www.fci.be/en/nomenclature/CHIEN-DE-CASTRO-LABOREIRO-170.html) gives Cão de Castro Laboreiro and English “Castro Laboreiro Dog” on one standard. |
| `classification.decisions.VBO:0200546` | Collapse French Pointing Dog - Pyrenean Type into Braque Français Pyrenean (`VBO:0200226`). [FCI 134](https://www.fci.be/en/nomenclature/FRENCH-POINTING-DOG-PYRENEAN-TYPE-134.html) gives the French and English names on one standard; the target also carries the AKC source. |
| `classification.decisions.VBO:0200539` | Treat “French Bulldog, Group 9 : Companion and Toy Dogs” as a source label for French Bulldog (`VBO:0201455`), not a selectable variety. [FCI 101](https://www.fci.be/en/nomenclature/FRENCH-BULLDOG-101.html) shows Group 9 as the breed's classification and separately lists its actual coat varieties. |
| `classification.decisions.VBO:0200462` | Collapse Dutch Sheeppoodle into Schapendoes (`VBO:0201181`) instead of presenting it as a crossbreed. Both pinned VBO nodes use Nederlandse Schapendoes as an exact synonym, and the [AKC Schapendoes page](https://www.akc.org/dog-breeds/schapendoes/) identifies Nederlandse Schapendoes / Dutch Schapendoes as the breed. |
| `classification.decisions.VBO:0200682` | Collapse Hungarian Water Dog into Puli (`VBO:0201102`). The source node names Puli as an exact synonym; [FCI 55](https://www.fci.be/en/nomenclature/PULI-55.html) and the target's AKC/Kennel Club/UKC sources use Puli/Hungarian Puli. |
| `classification.decisions.VBO:0201243` | Collapse Slovakian Hound into Slovenský Kopov (`VBO:0201246`). [FCI 244](https://www.fci.be/en/nomenclature/SLOVAKIAN-HOUND-244.html) presents Slovenský Kopov and English “Slovakian Hound” as one breed. |
| `classification.decisions.VBO:0201313` | Collapse Swedish Elkhound into Jämthund (`VBO:0200733`). [FCI 42](https://www.fci.be/en/nomenclature/JAMTHUND-42.html) is the Jämthund standard; the source synonym explicitly names Swedish Elkhound and carries the UKC page for that name. |
| `classification.decisions.VBO:0201369` | Collapse Transmontano Mastiff into Cão de Gado Transmontano (`VBO:0200286`). [FCI 368](https://www.fci.be/en/nomenclature/TRANSMONTANO-MASTIFF-368.html) is one standard for those names. |
| `classification.decisions.VBO:0201390`, `classification.decisions.VBO:0200723` | Keep Volpino Italiano (`VBO:0201390`) as the consumer identity and attach Italian Volpino as its registry alias. [FCI 195](https://www.fci.be/en/nomenclature/ITALIAN-VOLPINO-195.html) gives original “Volpino Italiano” and English “Italian Volpino”; the target carries AKC and UKC sources. |
| `classification.decisions.VBO:0200485`, `classification.decisions.VBO:0200236.targetId` | Collapse English/British Bulldog names directly into Bulldog (`VBO:0200258`). [FCI 149](https://www.fci.be/en/nomenclature/BULLDOG-149.html), AKC, CKC, and Kennel Club sources use Bulldog; the UKC source uses English Bulldog. “British Bulldog” remains searchable without an alias chain. |
| `classification.decisions.VBO:0200498` | Collapse English Toy Spaniel into King Charles Spaniel (`VBO:0200765`), which already owns the VBO coat varieties. [FCI 128](https://www.fci.be/en/nomenclature/KING-CHARLES-SPANIEL-128.html) and the Kennel Club use King Charles Spaniel; the source node's AKC/CKC/UKC pages use English Toy Spaniel for the same identity. |
| `classification.decisions.VBO:0200412`, `classification.decisions.VBO:0200863`, `classification.decisions.VBO:0201062`, `classification.decisions.VBO:0201407` | Treat the four VeNom `Old Format` rows as searchable legacy labels, not separate breeds/varieties: Dachshund → `VBO:0200406`, Manchester Terrier → `VBO:0200862`, Toy Poodle → `VBO:0201061`, and Welsh Corgi → `VBO:0201406`. Each source row is explicitly labeled Old Format; the targets preserve the current VBO identity and current official registry sources where one exists. |
| `classification.decisions.VBO:0201429`, `classification.decisions.VBO:0201430` | Exclude Wolf as a non-domestic canid and label generic Wolfdog as a crossbreed/type under Mixed Breed instead of a canonical breed. The pinned VBO nodes identify only generic “Wolf” and “Wolfdog”; specific dog breeds such as Czechoslovakian Wolfdog and Saarloos Wolfhond retain their own canonical identities. |
| `entities.VBO:0008003` | Display the FAO country-scoped source “Indigenous, Bangladesh” as “Bangladesh Indigenous Dog” so the runtime wording retains the country qualification instead of presenting “Indigenous” as a universal breed name. [FAO DAD-IS](https://www.fao.org/dad-is) remains the exact source. |
| `entities.VBO:0008005` | Display FAO “Balgarski barak, Bulgaria” as “Bulgarian Barak”; the pinned source synonyms include “Bulgarian coarse-haired hound - Barak.” [FAO DAD-IS](https://www.fao.org/dad-is) remains the exact source. |
| `entities.VBO:0008049` | Normalize the FAO all-caps label to “Small Međimurje Dog (Međi)” while retaining its exact VBO identity. The compiler now drops the C1-control mojibake synonym rather than exposing corrupted text. [FAO DAD-IS](https://www.fao.org/dad-is) remains the exact source. |
| `entities.VBO:0008093` | Expand country-scoped FAO “SA Greyhound, South Africa” to “South African Greyhound” without merging it into the English Greyhound identity. [FAO DAD-IS](https://www.fao.org/dad-is) remains the exact source. |

## Remaining editorial boundary

This pass verifies catalog identity, source traceability, and consumer wording. It does not assert
that registry recognition is universal, or add temperament, suitability, behavior, health, or
medical claims. The 20 remaining regional rows and 18 ambiguous search names are retained because
the pinned source supports them and the full-catalog collision pass did not establish a defensible
identity merge. Future primary evidence can still change an explicit override through the same
deterministic review path.
