# Dogs artwork batch delivery preparation — 2026-07-21

Status: **28 / 28 current ledger candidates processed, visually inspected, and approved through a
delegated accountable review; zero uploaded, delivered, or purpose-enabled.** This document records
batch-preparation evidence and the later approval boundary; it is not legal advice.
`data/dogs/image-rights.json` remains the fail-closed source of truth: every row is approved in
ledger `2026-07-21.2`, every delivery is still `not_ready`, and every UI/public/raster purpose flag
remains false.

## Method and outcome

- `data/dogs/artwork-crop-recipes.json` records one deliberate 3:2 crop for every exact asset in
  ledger `2026-07-21.1`. Recipes are bound to asset id, catalog id, and source SHA-256, and the batch
  preparer rejects missing, duplicated, stale, or ratio-invalid rows.
- `scripts/prepare-dog-artwork-batch.mjs` recursively located the 28 exact byte-verified originals
  already under `/tmp/stackrank-dogs-artwork-audit`, required exactly one SHA-256 match per current
  ledger row, and passed each local original through `scripts/process-dog-artwork.mjs`.
- The processor independently rechecked source SHA-256, SHA-1, and byte count; auto-oriented each
  original; applied only the tracked crop; stripped metadata; and emitted fixed-quality 320×213 and
  960×640 WebPs with immutable proposed object paths. No network download or upload was needed.
- Both variants for all 28 assets were visually inspected in full batch contact sheets. The dogs are
  legible at card size; ears, muzzles, and defining silhouettes are protected; no crop contains a
  recognizable person's face. Incidental faceless handlers remain in six show/conformation sources.
  The difficult Mucuchies source uses a tight head crop that excludes the recognizable seated
  bystander and limits the product display to a small edge fragment.
- Local batch report: `/tmp/stackrank-dogs-artwork-prepared-v2/dogs-artwork-batch-preparation.json`
- 960 contact sheet: `/tmp/stackrank-dogs-artwork-prepared-v2/contact-sheet-960.jpg`
- 320 contact sheet: `/tmp/stackrank-dogs-artwork-prepared-v2/contact-sheet-320.jpg`

The local manifests intentionally retain their immutable `generated_local` preparation status and
original pending visual-inspection text; they were not mutated or copied into the rights ledger.
The completed delegated approval separately records reviewer, decision date, rights notes, subject,
and non-copyright decisions in ledger `2026-07-21.2`. Delivery must now upload immutable bytes,
verify remote hashes and cache headers, and only afterward consider per-purpose grants and the
global artwork gate.

## Per-asset crop, deterministic bytes, and visual outcome

`Pass` below means both generated variants passed the crop/quality inspection. The source/crop was
subsequently approved in ledger `2026-07-21.2`, but that approval still does not permit any product
purpose until delivery and attribution compliance are verified.

| Source title / catalog concept | Crop `x,y,w,h` | 320×213 SHA-256 (bytes) | 960×640 SHA-256 (bytes) | Local crop/quality outcome |
| --- | --- | --- | --- | --- |
| Broholmer 634 (VBO:0000661) | 0,168,2916,1944 | `fb8c546039c836ca4a984ff60af3b31c92eacadec283b803d0d52f5299d4b161` (10,922 B) | `47584a8dcd77f1dd61d5e7b16d58974be9cef236d27637c5f4f090d81d5228a8` (60,210 B) | Pass — Complete profile; upper handler torso removed; only incidental lower bodies remain. |
| Dülmen, Hausdülmen, Golden Retriever -- 2022 -- 5945 (VBO:0200610) | 0,180,4364,2909 | `8c68b60d46f68ad6a4a9461e1ad6278f7b8aac49464e0258cfcc95086f2dc684` (10,246 B) | `6cf3783dc6b1f56e1a2b7032dab0fa5cd0b3058aae5c3cc5f3432d6d5c64e479` (69,212 B) | Pass — Full head, ears, and neck against a clean natural background. |
| Dachshund Dog Breed (VBO:0200406) | 0,120,1000,667 | `155e6ec5b34f67f6cdb3c901d775411f8474f0c3b248c1dbcb993ef80567079e` (13,876 B) | `b8920037fdcb77359de558cd9bceac8b0a31b840e2b040296a7162e7219b8d29` (61,108 B) | Pass — Complete dog; surrounding handler legs and clutter minimized. |
| Szpic fiński profil 980 (VBO:0200526) | 0,60,2382,1588 | `281b52dee43e16ed582080ae5c1aa7e4241be219d563891a198f3c7f8ab35814` (10,780 B) | `1b233d46c9f2d2cd3606bcc60f0bcbd9915fabcce4732ad22ad8841faa3d14bb` (86,700 B) | Pass — Uncluttered head-and-shoulders profile; muzzle and ear intact. |
| Dog niemiecki profil (VBO:0200623) | 0,0,2268,1512 | `667a3a7d07138f9ed602dc66aba80022354b6132a5f5b8d1b83bfb5736df26a7` (15,282 B) | `8d863619cd6e6e42cc1672b17aa3f2a40f7b8b85609888d20a379ea3aab084d9` (80,800 B) | Pass — Ear tips and muzzle protected; only a small faceless handler fragment remains. |
| Himalayan sheepdog (VBO:0200670) | 150,0,1553,1035 | `8c98d8d653193b8efaea23d8ec03dbe9b73d21c95316ba42a6758530c3f76eb1` (15,880 B) | `a3e95ee9e0dc95777240da8835e7fac23ae97e6371385f60b84862763a68d7b9` (92,276 B) | Pass — Entire resting dog and rock ledge; empty forest reduced. |
| ARIRANG (VBO:0200744) | 0,90,500,333 | `4c5a03b98c63fb93f300c738ed66a0ce814cc7410f16975dfa04f55e473fcb16` (12,196 B) | `40ed79d43e06818051d0bed6adc65e81bcbffb0f8713a603fb13ac293ea4f33b` (47,118 B) | Pass — Ears, face, chest, and curled tail legible; no person. |
| Yellow Labrador Retriever 2 (VBO:0200800) | 0,0,800,533 | `fafd3229cfbcfdc7e0416df654fbe4064bcf633fee69f5f817f6358849059bc2` (18,342 B) | `4f410e55cefb8b93b8dad18ffe08a72e34dac1aa5a2c47dd66db47d43dd95b13` (91,932 B) | Pass — Clean, complete conformation frame; one bottom pixel trimmed. |
| Mucuchies dog in Ávila Mont cut version (VBO:0200919) | 650,0,900,600 | `4360fd0974de3bab0b6f4a98be65e4224a60db374dfaf66d6a5e57037f5ce6cc` (16,484 B) | `a8062e8f8aabf433cbcde4974f3d48e566e81d1b6c6848a5bd56d90f98b8a048` (76,118 B) | Pass — Tight head portrait excludes the identifiable bystander; only a small product fragment remains. |
| New Guinea Singing Dog is singing (VBO:0200934) | 0,0,2554,1703 | `3dac11ae792c65ae24fd6a58930f0782c2a25c76b6abce8019c7d75a96b7203c` (7,080 B) | `4005483471f617030665b6d75a7eaabf829b3f0ec1b3ecd59ddd966243c5de78` (45,716 B) | Pass — Already-clean near-exact 3:2 head portrait retained. |
| Newfoundland brown (VBO:0200938) | 0,100,1140,760 | `37a2337bd788442c3ff51b20d89064aa8ec64dd75bbcb15e5d99bf56049efdfd` (14,072 B) | `3ee019a4a95eb4622313f0b392314ca13ed89c880d41e718d5d4b16538b0733e` (76,938 B) | Pass — Full body and face; excess snowy background reduced. |
| Noticia-122651-peruano (VBO:0201004) | 0,30,620,413 | `a5453cc3fdc85fd4dafcdc4d420edd513ebbdd0f1ea5b7e410375c1363846e74` (22,176 B) | `28f7f6da097fbe11430c9cfa98cd3d15bd715c51190b7f63a0094ae70e841b55` (82,366 B) | Pass — Entire stance preserved; only unused foreground/background removed. |
| Csalfa Sommer 07 10 A (VBO:0201102) | 0,80,2144,1429 | `64603811c8e4c0d98d981ca08ca9700cd1536ce482ffa0af37222a9702238e96` (16,632 B) | `4b7104fc94e9068b570241d584701316fb65f97ccd5ac957dd74ad536c44f5a2` (94,990 B) | Pass — Complete coat silhouette; unused ground reduced. |
| Akani Stehbild (VBO:0201135) | 0,70,1383,922 | `4cdaa34b136047077393259b3a79fd340720798d3add34719da60507456d570d` (8,634 B) | `d4ceabf61b9b3e4381371c2090ca75d9410103801fec2e92b9df8a861bc957a0` (48,836 B) | Pass — Complete stance; upper spectator bodies and event clutter removed. |
| Red Smooth Saluki (VBO:0201171) | 0,166,2266,1511 | `805aa7f127283fd3b52a2d086092fda54b413d0bf48b1a3c7e89cdeaf0954df8` (15,374 B) | `d1cf3d544860c74a70647025ec016f5a7021e093609b6fb8f2a55deea7fd6050` (72,314 B) | Pass — Full moving profile, nose, tail, and feet preserved. |
| A Shiba Inu head (VBO:0201220) | 0,12,3421,2281 | `b8d50eab88c3a35503be91c1c46a3cac88b424f4eb541121db66cc9f54998c97` (7,658 B) | `616481d64e8de3df244e5d6662e4b251cd82f1f989e6233a2fc8fa89f342c494` (51,838 B) | Pass — Clean head portrait with both ears and muzzle comfortably in frame. |
| Hiszpański pies wodny 333 (VBO:0201280) | 0,130,2550,1700 | `1bf0cc7d4325dacb138990fe32663b61213b985534207dfd494845ddd44cdc8d` (11,122 B) | `a5432618b0b454d6b30054805543cfdde71c913031210a093033561e4f25bcc1` (70,166 B) | Pass — Complete coat silhouette; show surface minimized. |
| Thai Ridgeback Dog Isabella (VBO:0201348) | 171,0,5130,3420 | `3ea8d10510a95abb0696a58d7ec04f42c6d7adae224e9d8236c490c8060b7486` (8,788 B) | `8061fb1d70f0da98a4cfccdd5ccadd9c85721bcfdeb33151ab12e4531a5390c3` (46,726 B) | Pass — Full profile, ears, back, tail, feet, and creator signature preserved. |
| Whippet 2018 6 (VBO:0201421) | 0,180,1504,1003 | `d6ffe098145b09b929bb7697fd254e6fce7c6baa4ea79970f463b92863e3af68` (11,494 B) | `e8e1c4ce21b8396f0e66770b456d50464a4929210d88dcb73f7b95653941aed5` (53,226 B) | Pass — Complete stance and feet; handler limited to faceless fragments. |
| XoloLarge1 (VBO:0201436) | 0,250,2032,1355 | `2678192c5817af44cb4bddd44233f99b25d745d485ff84bff34a55e165293fc8` (17,526 B) | `6cb72ff18c686ef38b45ec566e13de0dc76869ad38e5be6767ea2c6186d4cc19` (92,456 B) | Pass — Complete profile; unused lawn minimized. |
| Australian Cattle Dog sitting (VBO:0200088) | 0,350,2592,1728 | `6d4c0603f86c6d7c272ebc37d1b4714c9ce35127b38ef7ee10ba5021e16b4524` (10,082 B) | `a79ec3c2d5bbecb5e491ae734a8b859027e92e4bfb1cb528ccbbc825d8fea56c` (50,634 B) | Pass — Both ears, face, chest, and characteristic coat protected. |
| Azawakh Zamah Nisrin 'n Shat-Ehad (VBO:0200108) | 0,350,2700,1800 | `7f99791663f08c5b4c26d6900b03218d0d244a559e3197f2157f6931a2c89089` (13,026 B) | `89a9c7a140c5520aa99899e87f69dcce386e18ff519aaa94ab96624edc54bfff` (64,826 B) | Pass — Head, long neck, and full torso prioritized; people excluded. |
| Basenji-b&w (VBO:0200120) | 0,180,1958,1305 | `0108d2192f70a996bcd35ba40151688fb53769f890490040d192fa92e5ada029` (15,606 B) | `33fefa66ae48f53b47918afb2406a6f21f49e25f5fc85598747da3012e58f66e` (68,294 B) | Pass — Complete stance and tail; upper handler body and most event sign removed. |
| Boerboel fawn (VBO:0200185) | 350,0,1928,1285 | `9dd1b4aab6a70646af3e9326e73019375acec328f8a81e606ef50849bebf0036` (16,432 B) | `c5d7b77dc87666f82632512340246b0314b9bb9104f943b290da9c105cf991f4` (148,792 B) | Pass — Complete profile without people, signage, or products. |
| Brazilian Terrier (VBO:0200231) | 300,400,3000,2000 | `4e36d33d9f236cd9ed1fb2c15cc278036b4a109fe2427d857598a4e8ac3c16e0` (10,752 B) | `8d0a6c342849c9d017cb737432841c3b9ab0c35cef0918753ecbf32fdc3237aa` (58,670 B) | Pass — Complete stance dominant; event number reduced and handler faceless. |
| Chihuahua qui profite du soleil (VBO:0200338) | 0,1,3000,2000 | `d9c41a2a3bef4664be16f299e3ffe72f2b51949f51bb270a17d6dade4e99f5ca` (25,502 B) | `c2c71d0829b17dc2bd734dec0a12d34ee0296b3e670aff0fbaa855c3df9c7d94` (183,344 B) | Pass — Clean close portrait with no people, signage, or products. |
| Chinese Crested naked 1 (VBO:0200345) | 0,160,1434,956 | `fad5ddeee3611f93deb532f36e74f948ba3e85546022dfb132007f3f2cd047d7` (19,178 B) | `bdbcf806dac916c2d7af16b119210561cbc6924ff62a3d43a38841b8eac692ec` (108,950 B) | Pass — Complete stance and crest; unused grass reduced. |
| Coton de Tulear 188 (VBO:0200389) | 0,5,3872,2581 | `580c70285ac0bcb34cecf7b909776d42081fa9fced6973a45e29a7be132fad80` (15,230 B) | `ee23d539515bcaf590c90c14a763d092c3d16cfc8797bda64a7d46fe161c8e1b` (78,816 B) | Pass — Nearly complete clean frame with full coat silhouette. |

## Remaining operator gates

1. Completed: all 28 exact source/crop decisions now record reviewer, date, rights notes, subject
   match, and non-copyright restrictions review in ledger `2026-07-21.2`.
2. Immutably upload the exact 320/960 bytes with the declared cache headers,
   then verify public GET content type, byte count, SHA-256, and cache control.
3. Copy verified delivery variants into the ledger without changing source identity, crop, or hashes.
4. Decide UI and public-snapshot grants separately. Keep raster export denied until its attribution
   and ShareAlike strategy receives its distinct review.
