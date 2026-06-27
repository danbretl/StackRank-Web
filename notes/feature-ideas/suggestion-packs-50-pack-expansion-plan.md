# Suggestion packs: 50-pack expansion plan

Status: complete, local-only. Created 2026-06-25 so a future session can continue without reconstructing intent.

## Current baseline

- Implemented pack count before this pass: 20.
- Target after this pass: 50.
- New packs added: 30.
- Final generated count: 50 packs, 578 movies across 19 categories.
- Source file: `data/suggestion-packs.source.json`.
- Generated file: `data/suggestion-packs.json`.
- Authoring command: `node scripts/author-suggestion-packs.mjs`.
- Validation command:
  - `node --check app.js`
  - `node --check scripts/author-suggestion-packs.mjs`
  - custom pack harness checking total count, missing ids, missing posters, and source/output year mismatches.
- Important: do not pass `--upload` unless Dan explicitly asks. This pass is local file work only.

## API key note

No TMDB key is required to continue. The authoring script can resolve through the existing Supabase TMDB proxy using the public anon key from `app.js`. If `TMDB_API_KEY` is provided in the shell, the script uses TMDB directly; otherwise it falls back to the proxy. In both cases, service-role writes only happen when `--upload` is passed.

## Curation principles for this pass

- Favor packs that customers can understand instantly and would naturally want to settle.
- Add categories that are underrepresented in the first 20: actors, cinematographers, composers, production labels, locations, decades, national cinema, documentaries, animation, seasonal/occasion, and broader franchises.
- Keep most packs around 10-14 movies. Larger packs are okay when the set is finite and the category merits it.
- Repeats across packs are acceptable, but avoid turning the library into the same 15 movies shuffled.
- Titles should be clear, with the main hook in the title and the subtitle explaining the scope without being too clever.
- Prefer recognizable entries. This is a ranking product, not a trivia product.

## Public inspiration surfaces

- A24 official films list for production-label ideas.
- Palme d'Or winner lists for Cannes/canon ideas.
- Academy Best International Feature lists for global-cinema ideas.
- National Film Registry lists for American-canon and preservation ideas.
- Existing earlier inspiration: AFI, BFI/Sight & Sound, Letterboxd official lists.

## Planned 30 packs

1. **A24 Starter Pack** - recognizable A24 breakouts and audience favorites.
2. **Blumhouse Horror Hits** - mainstream Blumhouse horror, not an exhaustive dump.
3. **Disney Renaissance** - the compact 1989-1999 animation run.
4. **DreamWorks Animation Hits** - popular DreamWorks animated features.
5. **Mission: Impossible Saga** - all theatrical Mission: Impossible films.
6. **James Bond: Modern Era** - Bond from GoldenEye forward.
7. **Lord of the Rings and Hobbit** - Middle-earth theatrical features.
8. **Star Wars Skywalker Saga** - Episodes I-IX only.
9. **Marvel Phase One** - compact MCU entry pack.
10. **Batman on Film** - major theatrical Batman-centered films.
11. **New York Stories** - movies where NYC is core to the appeal.
12. **Los Angeles Stories** - LA as setting, mood, or industry machine.
13. **Chicago Stories** - Chicago-set or Chicago-coded crowd favorites.
14. **1970s New Hollywood** - major American 1970s landmarks.
15. **1980s Blockbuster DNA** - broad, popular 1980s genre/blockbuster set.
16. **1990s Indie Breakouts** - Sundance/Miramax/indie-crossover energy.
17. **2000s Comedy Canon** - broadly known studio comedies.
18. **2010s Prestige Hits** - award-season and critic/audience prestige favorites.
19. **Denzel Washington Essentials** - major Denzel roles across eras.
20. **Leonardo DiCaprio Essentials** - major DiCaprio roles, not just Oscar bait.
21. **Meryl Streep Essentials** - iconic Streep roles across decades.
22. **Tom Hanks Comfort Canon** - broad Hanks crowd favorites.
23. **Roger Deakins Shot It** - cinematographer-driven pack with recognizable films.
24. **John Williams Scores** - composer-driven blockbuster/classic pack.
25. **Hans Zimmer Scores** - composer-driven modern blockbuster pack.
26. **Korean Cinema Gateways** - accessible Korean classics and modern breakouts.
27. **French New Wave Starters** - compact entry points, not too academic.
28. **Documentary Breakouts** - docs people actually talk about and rank.
29. **Halloween Night Picks** - seasonal horror with broad recognition.
30. **Christmas Movie Arguments** - holiday movies people debate every year.

## Progress checklist

- [x] Expansion plan documented.
- [x] Add 30 packs to `data/suggestion-packs.source.json`.
- [x] Regenerate `data/suggestion-packs.json`.
- [x] Run validation harness and fix bad resolutions.
- [x] Run syntax checks.
- [x] Update this note with final counts and any known caveats.

## Final validation results

- `node scripts/author-suggestion-packs.mjs` completed and wrote `data/suggestion-packs.json`.
- Upload was skipped; no Supabase rows were written.
- Generated count: 50 packs.
- Generated movie count: 578 movies.
- Missing poster paths: 0.
- Missing TMDB ids: 0.
- Source/output year mismatches: 0.
- Movies appearing in more than four packs: 0.
- Syntax checks passed:
  - `node --check app.js`
  - `node --check scripts/author-suggestion-packs.mjs`

## Authoring script update made during this pass

The script now preserves curated source `title` and `year` values while still resolving `tmdbId` and `posterPath` through TMDB/the Supabase proxy. This avoids awkward display regressions when TMDB's canonical title differs from the app's intended user-facing label, such as regional or alternate titles.

## Known implementation details

- Existing sort orders run 10-210 with a gap at 140. Use 220-510 for the 30 new packs to keep this pass easy to review.
- The authoring proxy search can mis-rank unusual punctuation. If a resolution is wrong, add a `tmdbId` to the source entry and regenerate.
- After generation, align source years to TMDB years only when the mismatch is a known release-year convention and the id is correct.
