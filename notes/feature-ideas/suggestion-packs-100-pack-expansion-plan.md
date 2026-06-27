# Suggestion packs: 100-pack expansion plan

Status: **complete, local fallback library (2026-06-27).**

## Goal

Expand the curated fallback library from **50 to 100 packs** in five recoverable
batches of ten. Each batch must regenerate `data/suggestion-packs.json` and pass
the pack validation harness before the next batch begins.

This pass prioritizes breadth without turning the library into the same popular
movies reshuffled under different labels.

## Overlap guardrails

- No duplicate slug or title.
- No duplicate movie inside a pack.
- Most packs should contain 8–14 movies; a compact finite filmography can be
  smaller when the project is still obviously worthwhile.
- A new pack should overlap any other pack by no more than four movies and no
  more than 35% of its smaller set.
- No movie should appear in more than six packs across the 100-pack library.
- Prefer a recognizable movie that is new to the library over a fifth appearance
  by an existing anchor title.
- Validation runs after every ten-pack batch, not only at the end.

## Batch plan

### Batch 1 — filmmakers (packs 51–60)

- [x] Sofia Coppola Filmography
- [x] Yorgos Lanthimos Filmography
- [x] Denis Villeneuve Filmography
- [x] David Fincher Filmography
- [x] Paul Thomas Anderson Filmography
- [x] Guillermo del Toro Worlds
- [x] Spike Lee Essentials
- [x] Coen Brothers Essentials
- [x] Pedro Almodóvar Gateways
- [x] Wong Kar-wai Gateways

### Batch 2 — performers (packs 61–70)

- [x] Tilda Swinton Transformations
- [x] Nicolas Cage: Full Voltage
- [x] Michelle Yeoh Essentials
- [x] Cate Blanchett Essentials
- [x] Ethan Hawke Across Eras
- [x] Viola Davis Essentials
- [x] Keanu Reeves: Whoa to Wick
- [x] Toni Collette Range
- [x] Philip Seymour Hoffman Essentials
- [x] Jeff Goldblum Energy

### Batch 3 — world cinema and movements (packs 71–80)

- [x] Japanese Postwar Classics
- [x] Hong Kong Action Essentials
- [x] Taiwanese New Wave Gateways
- [x] Iranian Cinema Gateways
- [x] Indian Cinema Gateways
- [x] Italian Neorealism
- [x] German New Cinema
- [x] Mexican Cinema Gateways
- [x] Brazilian Cinema Gateways
- [x] Nordic Cinema Gateways

### Batch 4 — genres and microgenres (packs 81–90)

- [x] Folk Horror
- [x] Courtroom Dramas
- [x] Time Travel Trouble
- [x] Body Horror
- [x] Screwball Comedy
- [x] Coming-of-Age Essentials
- [x] One-Location Pressure Cookers
- [x] Revenge Served Cold
- [x] Food on Film
- [x] Movie Musicals Across Eras

### Batch 5 — forms, settings, and durable arguments (packs 91–100)

- [x] Stop-Motion Essentials
- [x] Silent Comedy
- [x] Political Thrillers
- [x] Journalism Movies
- [x] Workplace Comedies
- [x] Road Movies
- [x] Survival Stories
- [x] Alone in Space
- [x] Vampire Movies
- [x] Summer Camp Movies

## Batch completion record

Update this section after each generated batch with:

- final pack/movie/category counts;
- highest pairwise overlap;
- highest per-movie reuse count;
- any title-resolution corrections;
- commands run and their result.

### Batch 1 complete

- Library: **60 packs / 693 movie placements / 550 unique movies / 19
  categories**.
- Highest expansion overlap: Coen Brothers Essentials × Roger Deakins Shot It,
  4 movies / 33% of the smaller pack.
- Highest movie reuse remains 4 packs.
- Replaced the planned Bong Joon-ho filmography after validation showed 50%
  overlap with Korean Cinema Gateways; Yorgos Lanthimos Filmography passed the
  guardrails.
- `npm run author:packs` and `npm run validate:packs` passed.

### Batch 2 complete

- Library: **70 packs / 821 movie placements / 639 unique movies / 19
  categories**.
- Highest expansion overlap remains 4 movies / 33% (Coen Brothers Essentials ×
  Roger Deakins Shot It); no performer pack became the new maximum.
- Highest movie reuse remains 4 packs.
- The generated cache reused 730 movie records and resolved 91 new records.
- `npm run author:packs` and `npm run validate:packs` passed.

### Batch 3 complete

- Library: **80 packs / 940 movie placements / 754 unique movies / 20
  categories**.
- Added Movement as a distinct browse category while extending National cinema
  beyond the existing Korean/French coverage.
- Highest expansion overlap remains 4 movies / 33%; highest movie reuse remains
  4 packs.
- The generated cache reused 825 movie records and resolved 115 new records.
- `npm run author:packs` and `npm run validate:packs` passed.

### Batch 4 complete

- Library: **90 packs / 1,064 movie placements / 841 unique movies / 20
  categories**.
- Highest expansion overlap remains 4 movies / 33%.
- Highest movie reuse increased from 4 to 5 packs (Reservoir Dogs), still below
  the six-pack ceiling.
- The generated cache reused 976 movie records and resolved 88 new records.
- `npm run author:packs` and `npm run validate:packs` passed.

### Batch 5 complete

- Final library: **100 packs / 1,185 movie placements / 937 unique movies / 22
  categories**.
- Highest expansion overlap: 4 movies / 33% (Coen Brothers Essentials × Roger
  Deakins Shot It).
- Highest movie reuse: 5 packs (Reservoir Dogs), below the six-pack ceiling.
- The generated cache reused 1,087 movie records and resolved 98 new records.
- `npm run author:packs` and `npm run validate:packs` passed.

## Final result

The expansion added 50 packs in the planned five batches with no failed
guardrails in the final data. The original library's pre-existing Neo-Noir × Los
Angeles overlap (5 movies / 42%) remains reported but grandfathered; no new pack
matches or exceeds it.

The generated library remains local/fallback data. Uploading to Supabase still
requires an explicit `--upload` run with the service-role key and is not part of
this content pass.
