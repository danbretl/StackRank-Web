# Dogs artwork candidate audit — 2026-07-21

Status: **accountable delegated source/crop review complete; 28 / 28 approved assets delivered for
UI display on July 22, 2026.** Dan Bretl explicitly delegated the editorial and rights-evidence
review to OpenAI Codex on 2026-07-21. Ledger `2026-07-21.2` transparently identifies that reviewer
and records a concrete per-asset decision. This is not legal advice. Delivery subsequently granted
only the UI-display product purpose; public-snapshot and raster-export artwork purposes remain
denied.

## Outcome

- All **28 / 28** initial candidate originals were downloaded from their exact recorded Commons
  URLs on 2026-07-21. Two stronger replacement originals were later imported for Finnish Spitz and
  Thai Ridgeback. Every one of the 30 downloaded SHA-256 values matched its ledger or create-only
  candidate record; fresh Commons Imageinfo queries also matched every recorded SHA-1, byte count,
  MIME type, and source-page revision.
- All 30 file pages were present. Their current exact license labels matched the recorded evidence
  and their Commons `Restrictions` metadata was empty. No pinned page wikitext contained a
  deletion, copyvio, or permission-pending warning.
- All 30 source pages explicitly identify the pictured subject as the associated canonical breed/type
  through the file description and/or Commons category. Visual inspection found no contradictory
  subject. Himalayan Sheepdog and Mucuchies remain moderate-confidence rather than registry-grade
  identifications because their evidence is a creator-supplied Commons description/category, not a
  kennel-registry record.
- **All 28 current ledger candidates passed the accountable delegated decision.** Their exact source
  revisions, byte hashes, license/provenance chains, subject evidence, non-copyright concerns, and
  deliberate 3:2 crops were accepted in ledger `2026-07-21.2`. The Dachshund source-requested
  creator link was objectively corrected before approval. Stronger Finnish Spitz and Thai Ridgeback
  sources replace the two weaker, never-approved rows.
- The two replacement candidates and all other current rows were locally processed and inspected.
  All 28 were approved on July 21, then delivered and enabled for UI display on July 22 after the
  separate production Storage and attribution gates passed. Public-snapshot and raster-export use
  remains denied. Approval alone was not deployment or display permission.

Current-ledger license distribution: 4 CC BY 2.0, 12 CC BY-SA 3.0, 11 CC BY-SA
4.0, and 1 CC0 1.0. The CC BY/CC BY-SA licenses permit commercial reuse and modification subject
to attribution; BY-SA derivatives also require share-alike. Creative Commons warns that privacy,
publicity, and moral rights can still affect a use, so those issues were reviewed separately below.

## Delivery addendum — 2026-07-22

After the authorized production Storage migration and its real access-control fixture passed, the
operator delivered the exact approved batch under immutable object names in the versioned
`dogs-catalog` prefix:

- 28 assets, each with its approved 320×213 and 960×640 WebP derivative (`56` objects total);
- every remote object matched its delivery manifest bytes and MIME type and returned the intended
  immutable cache policy;
- the ledger records the delivered variants and enables `uiDisplayAllowed` for all 28 assets;
- `publicSnapshotAllowed` and `rasterExportAllowed` remain false for every asset.

The runtime catalog now references this batch for normal Dogs UI surfaces and preserves the neutral
fallback for the rest of the catalog. Attribution remains attached to each delivered asset. The
repository contains the ledger/catalog references, not the image bytes themselves. No commit, push,
deployment, or production-root redirect change was part of this delivery pass.

## Candidate decisions

This table records the recommendations immediately before the final delegated decision.
`Batch-ready` means the evidence supported approval after inspection of the chosen crop; every
current row marked that way below was approved in ledger `2026-07-21.2`. `Fix credit` meant do not
approve until the exact attribution request was represented in the ledger and rendered
Credits/detail surfaces. `Replace` meant keep the prior row pending and source a better candidate;
both replacements were completed before approval.

| Catalog concept | Exact Commons source / selected license | Subject, crop, and restrictions review | Recommendation |
| --- | --- | --- | --- |
| Broholmer (`VBO:0000661`) | [Broholmer 634](https://commons.wikimedia.org/wiki/File:Broholmer_634.jpg), CC BY-SA 3.0 | Source description/category says Broholmer; clear side profile. Crop can keep the dog while leaving only unrecognizable handler bodies. | Batch-ready |
| Golden Retriever (`VBO:0200610`) | [Dülmen… Golden Retriever](https://commons.wikimedia.org/wiki/File:D%C3%BClmen,_Hausd%C3%BClmen,_Golden_Retriever_--_2022_--_5945.jpg), CC BY-SA 4.0 | Creator-authored featured/quality image and explicit Golden Retriever description; clean head portrait, no people or marks. | Batch-ready |
| Dachshund (`VBO:0200406`) | [Dachshund Dog Breed](https://commons.wikimedia.org/wiki/File:Dachshund_Dog_Breed.jpg), CC BY-SA 3.0 | Explicit Dachshund description/category and clear dog. File description asks reuse to credit/link `http://pdpics.com/`; ledger attribution records the exact request and its HTTPS `creatorUrl` uses the same site instead of a dead Commons-user URL. | Batch-ready; credit corrected |
| Finnish Spitz (`VBO:0200526`) | [Szpic fiński profil 980](https://commons.wikimedia.org/wiki/File:Szpic_fi%C5%84ski_profil_980.jpg), CC BY-SA 3.0 | Own-work description/category identifies a Finnish Spitz at the World Dog Show in Poznań. The inspected 3:2 crop is a sharp, uncluttered head profile without recognizable people, event graphics, or special credit request. | Batch-ready; pending replacement promoted |
| Great Dane (`VBO:0200623`) | [Dog niemiecki profil](https://commons.wikimedia.org/wiki/File:Dog_niemiecki_profil.jpg), CC BY-SA 3.0 | Description/category identifies Great Dane; distinctive, sharp head profile. Handler is not identifiable after a deliberate crop. | Batch-ready |
| Himalayan Sheepdog (`VBO:0200670`) | [Himalayan sheepdog](https://commons.wikimedia.org/wiki/File:Himalayan_sheepdog.jpg), CC0 1.0 | Creator-supplied description places a Himalayan Sheepdog in Munsiyari, India; category agrees. Dog is relatively small in frame but a faithful 3:2 landscape crop is viable. No people or marks. | Batch-ready, moderate subject confidence |
| Jindo (`VBO:0200744`) | [ARIRANG](https://commons.wikimedia.org/wiki/File:ARIRANG.jpg), CC BY-SA 4.0 | Own-work page says Korean Jindo Dog and carries the matching category. Portrait is clear; use an upper-body crop rather than cutting the ears. Chain is visible but not misleading. | Batch-ready |
| Labrador Retriever (`VBO:0200800`) | [Yellow Labrador Retriever 2](https://commons.wikimedia.org/wiki/File:Yellow_Labrador_Retriever_2.jpg), CC BY-SA 3.0 | Explicit Yellow Labrador Retriever description/category and clean conformation side view. | Batch-ready |
| Mucuchies (`VBO:0200919`) | [Mucuchies dog in Ávila Mont](https://commons.wikimedia.org/wiki/File:Mucuchies_dog_in_%C3%81vila_Mont_cut_version.jpg), CC BY-SA 3.0 | Own-work source and category identify Mucuchies; appearance is consistent. A tight dog-first crop must exclude the recognizable seated bystander at right and minimize product display/handler. | Batch-ready, moderate subject confidence; crop required |
| New Guinea Singing Dog (`VBO:0200934`) | [New Guinea Singing Dog is singing](https://commons.wikimedia.org/wiki/File:New_Guinea_Singing_Dog_is_singing.jpg), CC BY 2.0 | Flickr source and passed FlickreviewR record explicitly identify the subject; clear vocalizing head portrait, no people or marks. | Batch-ready |
| Newfoundland (`VBO:0200938`) | [Newfoundland brown](https://commons.wikimedia.org/wiki/File:Newfoundland_brown.jpg), CC BY-SA 3.0 | De-Wikipedia creator chain and license-migration record are present; description says brown Newfoundland and category agrees. Clean full-dog crop. | Batch-ready |
| Peruvian Hairless Dog (`VBO:0201004`) | [Noticia-122651-peruano](https://commons.wikimedia.org/wiki/File:Noticia-122651-peruano.jpg), CC BY-SA 4.0 | Own-work source/category says Peruvian Hairless Dog; clear, breed-relevant full profile. | Batch-ready |
| Puli (`VBO:0201102`) | [Csalfa Sommer 07 10 A](https://commons.wikimedia.org/wiki/File:Csalfa_Sommer_07_10_A.jpg), CC BY-SA 3.0 | Own-work description explicitly identifies a female Puli; characteristic coat and matching category. No people or marks. | Batch-ready |
| Rhodesian Ridgeback (`VBO:0201135`) | [Akani Stehbild](https://commons.wikimedia.org/wiki/File:Akani_Stehbild.JPG), CC BY-SA 3.0 | Own-work description/category says Rhodesian Ridgeback; clear show stance. Crop can exclude unrecognizable surrounding people. | Batch-ready |
| Saluki (`VBO:0201171`) | [Red Smooth Saluki](https://commons.wikimedia.org/wiki/File:Red_Smooth_Saluki.jpg), CC BY-SA 3.0 | Creator describes a five-year-old smooth Saluki; category and distinctive full-body view agree. Creator is supplied only as `r.`, but that exact supplied attribution is recorded. | Batch-ready |
| Shiba Inu (`VBO:0201220`) | [A Shiba Inu head](https://commons.wikimedia.org/wiki/File:A_Shiba_Inu_head.jpg), CC BY 2.0 | Flickr upload-bot review records Maja Dumat and CC BY 2.0; exact Shiba description/category and clear head portrait. Current creator name/link honors the supplied credit. | Batch-ready |
| Spanish Water Dog (`VBO:0201280`) | [Hiszpański pies wodny 333](https://commons.wikimedia.org/wiki/File:Hiszpa%C5%84ski_pies_wodny_333.jpg), CC BY-SA 3.0 | Own-work description and `Perro de Agua Español` category agree; characteristic coat and full profile. Show tag/handler can be minimized; no face is visible. | Batch-ready |
| Thai Ridgeback (`VBO:0201348`) | [Thai Ridgeback Dog Isabella](https://commons.wikimedia.org/wiki/File:Thai_Ridgeback_Dog_Isabella.jpg), CC BY-SA 4.0 | Own-work description explicitly identifies a Thai Ridgeback Dog in the Isabella color. The inspected 3:2 crop preserves the entire dog in a clean outdoor profile with no person or product mark. | Batch-ready; pending replacement promoted |
| Whippet (`VBO:0201421`) | [Whippet 2018 6](https://commons.wikimedia.org/wiki/File:Whippet_2018_6.jpg), CC BY-SA 4.0 | Own-work description says fawn-brindle Whippet; category and clear profile agree. Crop can exclude unrecognizable handler bodies. | Batch-ready |
| Xoloitzcuintli (`VBO:0201436`) | [XoloLarge1](https://commons.wikimedia.org/wiki/File:XoloLarge1.jpg), CC BY-SA 4.0 | Own-work description identifies a large Xoloitzcuintli; category and clear full profile agree. | Batch-ready |
| Australian Cattle Dog (`VBO:0200088`) | [Australian Cattle Dog sitting](https://commons.wikimedia.org/wiki/File:Australian_Cattle_Dog_sitting.jpg), CC BY 2.0 | Flickr upload-bot reviewer recorded Michael Hays and CC BY 2.0; explicit Blue Heeler description/category and clear portrait. Use an upper-body crop to keep both ears. | Batch-ready |
| Azawakh (`VBO:0200108`) | [Zamah Nisrin 'n Shat-Ehad](https://commons.wikimedia.org/wiki/File:Azawakh_Zamah_Nisrin_%27n_Shat-Ehad.jpg), CC BY-SA 4.0 | Own-work description supplies breed, registered name, sex, registry number, pedigree, producer, and owner. Portrait source needs an upper-body 3:2 crop; no recognizable person. | Batch-ready |
| Basenji (`VBO:0200120`) | [Basenji-b&w](https://commons.wikimedia.org/wiki/File:Basenji-b%26w.jpg), CC BY-SA 4.0 | Own-work description/category says black-and-white Basenji; clear show stance. Crop can minimize unrecognizable handler body. | Batch-ready |
| Boerboel (`VBO:0200185`) | [Boerboel fawn](https://commons.wikimedia.org/wiki/File:Boerboel_fawn.jpg), CC BY-SA 4.0 | Own-work description/category says fawn Boerboel; clear full side profile and no people. | Batch-ready |
| Brazilian Terrier (`VBO:0200231`) | [Brazilian Terrier](https://commons.wikimedia.org/wiki/File:Brazilian_Terrier.jpg), CC BY 2.0 | Flickr upload-bot reviewer recorded Juliana Lopes and CC BY 2.0; exact description/category and clear full dog. | Batch-ready |
| Chihuahua (`VBO:0200338`) | [Chihuahua qui profite du soleil](https://commons.wikimedia.org/wiki/File:Chihuahua_qui_profite_du_soleil.jpg), CC BY-SA 4.0 | Own-work description/category says Chihuahua; clean, sharp close portrait with no people or marks. | Batch-ready |
| Chinese Crested (`VBO:0200345`) | [Chinese Crested naked 1](https://commons.wikimedia.org/wiki/File:Chinese_Crested_naked_1.jpg), CC BY-SA 4.0 | Own-work description/category says Chinese Crested; clear standing profile and no people. | Batch-ready |
| Coton de Tulear (`VBO:0200389`) | [Coton de Tulear 188](https://commons.wikimedia.org/wiki/File:Coton_de_Tulear_188.jpg), CC BY-SA 3.0 | Own-work description identifies the named Coton de Tuléar and category agrees; clean dog-only frame. | Batch-ready |

## Replacement candidates verified on 2026-07-21

Both replacements were imported with `scripts/fetch-dog-artwork.mjs commons`, which re-fetched the
exact current Commons revision and original bytes, verified Commons SHA-1 and byte count, computed
SHA-256, rejected unsupported metadata, and emitted a create-only pending candidate under `/tmp`.
Both were then processed locally with the deterministic ImageMagick recipe; the 320×213 and 960×640
WebPs were visually inspected. Their source records now replace the weaker Thai Ridgeback and
Finnish Spitz rows in the tracked ledger. They were subsequently approved in the delegated final
review. At the end of this July 21 replacement pass they still had empty delivery variants and every
purpose denied; nothing was uploaded until the separately gated July 22 delivery recorded above.

### Thai Ridgeback replacement — recommended

- Source: [Thai Ridgeback Dog Isabella](https://commons.wikimedia.org/wiki/File:Thai_Ridgeback_Dog_Isabella.jpg)
  by VrnRossetti, own work, **CC BY-SA 4.0**.
- Commons revision: `1151760209` at `2026-01-23T12:07:21Z`; description explicitly says Thai
  Ridgeback Dog in the Isabella color and the exact pinned wikitext contains `self|cc-by-sa-4.0`.
  Commons restrictions metadata is empty.
- Original: JPEG, 5472×3420, 10,081,589 bytes; SHA-1
  `0bcc6aff8ac0d47e1447c9ee041a7d2ad77d56cc`; SHA-256
  `7216a3abd0f9289fb8393dfc81ab7fea2599e53587498c3b3a7519806dc25b86`.
- Crop: `171,0,5130,3420`. It preserves the whole dog, ears, ridge-bearing back, tail, and feet in a
  clean outdoor profile with no person or product mark. The creator's small embedded signature
  remains visible and is not obscured.
- Local variants: 320×213, 8,788 bytes, SHA-256
  `3ea8d10510a95abb0696a58d7ec04f42c6d7adae224e9d8236c490c8060b7486`; 960×640, 46,726
  bytes, SHA-256 `8061fb1d70f0da98a4cfccdd5ccadd9c85721bcfdeb33151ab12e4531a5390c3`.
- Attribution: `Thai Ridgeback Dog Isabella — VrnRossetti; CC BY-SA 4.0; via Wikimedia Commons.`
  Any delivered derivative must also carry the tracked crop/resize/WebP modifications and BY-SA
  compliance.

### Finnish Spitz replacement — recommended

- Source: [Szpic fiński profil 980](https://commons.wikimedia.org/wiki/File:Szpic_fi%C5%84ski_profil_980.jpg)
  by Pleple2000, own work, **CC BY-SA 3.0**.
- Commons revision: `1068571293` at `2025-08-08T19:39:25Z`; description says the Finnish Spitz was
  photographed at the World Dog Show in Poznań, the category is Finnish Spitz, and pinned wikitext
  includes the CC BY-SA 3.0 license-migration template. Commons restrictions metadata is empty.
- Original: JPEG, 2382×1746, 630,530 bytes; SHA-1
  `b8e00ca699a69f82bc8ba72792769324e1f9089b`; SHA-256
  `36db1ccf81187f878caec4ab8293950937538eb8afcd2c3763127b5c04b30998`.
- Crop: `0,60,2382,1588`. It creates a sharp, uncluttered head-and-shoulders profile with both the
  muzzle and ear intact; no recognizable person, event graphic, or product remains in frame.
- Local variants: 320×213, 10,780 bytes, SHA-256
  `281b52dee43e16ed582080ae5c1aa7e4241be219d563891a198f3c7f8ab35814`; 960×640, 86,700
  bytes, SHA-256 `1b233d46c9f2d2cd3606bcc60f0bcbd9915fabcce4732ad22ad8841faa3d14bb`.
- Attribution: `Szpic fiński profil 980 — Pleple2000; CC BY-SA 3.0; via Wikimedia Commons.` Any
  delivered derivative must also carry the tracked crop/resize/WebP modifications and BY-SA
  compliance. This supersedes the weaker Pets Adviser show-table candidate and removes its special
  attribution request from the current ledger.

## Superseded pending sources retained for audit history

These sources were structurally valid but were replaced before approval or delivery. They are not
current ledger rows and must not be counted as coverage.

- Finnish Spitz: `dogs:photo:commons:28c58a1d225fa769`, [GCH Dv9k9's Red Hot Star aka Rocket 2](https://commons.wikimedia.org/wiki/File:Finnish_Spitz_-_GCH_Dv9k9%27s_Red_Hot_Star_aka_Rocket_2_(16576435166).jpg),
  Commons revision `1209629160`, CC BY 2.0, source SHA-256
  `28c58a1d225fa7695373471d4e92ffa9e3a41cd444e3e9d75c4dc01a9c12de2a`. FlickreviewR preserved
  the license chain, but the source requires credit to `http://www.petsadviser.com/` rather than
  Flickr; that URL currently redirects to `https://www.petful.com/`. It was replaced because the
  sleeping show-table composition and visible event graphics were weaker than the new head profile.
- Thai Ridgeback: `dogs:photo:commons:6ad0e802560cb0bb`, [Thairidgebblue](https://commons.wikimedia.org/wiki/File:Thairidgebblue.jpg),
  Commons revision `903888879`, CC BY 4.0, source SHA-256
  `6ad0e802560cb0bbc2dfea9663162a74c4ea3bae393d2b9b02c4fa9b7739f6d7`. The source/license/subject
  evidence was acceptable, but the image was materially underexposed and handler legs dominated
  the left edge; the approved processing recipe does not include tonal correction.

## Evidence and method

The audit used the tracked ledger and catalog plus fresh, read-only primary-source evidence:

1. Download each recorded `originalUrl` with an identified user agent and compare SHA-256 to the
   ledger.
2. Query the Wikimedia Commons Imageinfo and revision APIs for all 28 exact file titles. Compare the
   exact pinned revision, original URL, SHA-1, byte count, MIME, dimensions, license label/URL,
   creator/credit, description, categories, and restrictions.
3. Fetch the exact pinned wikitext revisions. Confirm the selected allowlisted license template and
   inspect Flickr reviewer/upload-bot and Wikipedia license-migration chains where applicable.
4. Visually inspect all 28 originals and 3:2 center-crop previews. Note subject confidence,
   misleading crops, recognizable people, event signage/trademarks, and presentation quality.
5. Recheck the official [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
   and the exact Creative Commons deeds for [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/),
   [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
   [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
   [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), and
   [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The two source/credit fixes and the final delegated review are complete. Ledger `2026-07-21.2`
records the reviewer, decision date, concrete rights notes, subject match, and non-copyright review
for every current row. The July 22 operator pass immutably uploaded and byte-verified the exact
320×213 and 960×640 WebPs and enabled the global UI-display purpose only after delivery and
attribution verification. Public-snapshot and raster-export booleans remain false. Future long-tail
artwork must repeat the same per-asset review, delivery, and purpose-specific gate.
