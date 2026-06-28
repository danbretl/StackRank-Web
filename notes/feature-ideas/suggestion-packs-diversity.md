# Suggestion packs: broaden representation

**Status: shipped (2026-06-28).** Fourteen representation packs were added across two passes to address Catie's feedback that the packs skewed toward white and/or male audiences.

- **Pass 1 — thematic (6):** Black Cinema Essentials, Queer Cinema Essentials, Women Behind the Camera, Latino & Latin American Voices, Trans & Nonbinary Stories, African Cinema Gateways.
- **Pass 2 — creators + gaps (8):** director filmographies for **Jordan Peele, Ryan Coogler, Ava DuVernay, Mira Nair, Céline Sciamma, Alfonso Cuarón**, plus **Indigenous Cinema Gateways** and **Southeast Asian Cinema Gateways**.

All authored into `data/suggestion-packs.source.json` and built into `data/suggestion-packs.json` via the normal pipeline (resolved through the public `tmdb-search` proxy — no TMDB key needed). Total pack count is now 114.

**Deliberately skipped: Barry Jenkins.** His complete filmography is only 3 features (Medicine for Melancholy, Moonlight, If Beale Street Could Talk), two of which are already in the thematic packs — so a Jenkins pack overlaps Black Cinema Essentials at 67%, well over the validator's 35% `MAX_PAIR_SHARE`. His films are already surfaced via the Black/Queer/Women packs. Same caution applies to any other ultra-thin filmography that duplicates a thematic pack.

**Validator gotcha:** `scripts/validate-suggestion-packs.mjs` flags any pair (where either pack has `sort_order >= 520`) exceeding 4 shared movies or 35% share of the smaller pack. New packs are all `>= 1020`, so they're checked against everything. Keep small packs' overlap to a single shared film, or grow them (e.g. the Trans pack was grown 8→11 so its 3-film overlap with the Queer pack dropped under 35%).

**Supabase note (resolved 2026-06-28):** the `suggestion_packs` + `pack_progress` tables did not exist in the live database — the migration `supabase/migrations/20260625071336_add_suggestion_packs.sql` had never been applied to production, so `loadSuggestionPacks` always 404'd and the app ran entirely on the JSON fallback. Dan applied that migration via the **Supabase SQL Editor** (the CLI's `supabase db push` / `db query --linked` both failed in this environment: a `cli_login_postgres` "permission denied to alter role" error on the Management-API path, and a stale cached DB password on the direct path). All **114** packs were then uploaded with `node scripts/author-suggestion-packs.mjs --upload` (service-role key). The remote `suggestion_packs` table now mirrors the JSON, migration history records the schema, and the app's publishable-key RLS read of `active=true` is confirmed.

**Caveat — migration history:** because the migration was applied through the SQL Editor rather than `supabase db push`, it is **not recorded in the CLI's `supabase_migrations.schema_migrations` history**. A future `supabase db push` could try to re-apply it; the `create table/index if not exists` parts are safe, but the `create policy` statements would error ("policy already exists"). If/when someone runs `db push` again, either mark this migration applied (`supabase migration repair --status applied 20260625071336`) or make the policies idempotent (`drop policy if exists` before each `create policy`).

Remaining creator filmography packs and other gaps (Disability on screen, broader African/Asian coverage) are still open follow-ups.

> **Build note (resolved):** an earlier draft of this note worried we'd need a `TMDB_API_KEY`. We don't — `scripts/author-suggestion-packs.mjs` has a key-free path that resolves `tmdbId`/`posterPath` through the **public-client** `tmdb-search`/`tmdb-detail` edge functions using the publishable key baked into `app.js`. So `node scripts/author-suggestion-packs.mjs` (no env) regenerates the JSON. The only thing that needs a secret is the optional `--upload` to the Supabase `suggestion_packs` table (`SUPABASE_SECRET_KEY`, with legacy `SUPABASE_SERVICE_ROLE_KEY` fallback); it's not required because `mergePackLibraries` makes new fallback-JSON slugs appear for signed-in users too.

## Why not just edit the JSON

`data/suggestion-packs.json` (what the app loads) is **generated** from `data/suggestion-packs.source.json` by `scripts/author-suggestion-packs.mjs`, which resolves each movie's `tmdbId` + `posterPath` from TMDB. Hand-writing ids/posters is error-prone. So the right move is: add packs to the **source** file with `title` + `year` (+ optional `tmdbId` when known), then run the author script and validate.

## What already exists (don't duplicate)

Spike Lee, Viola Davis, Denzel Washington, Michelle Yeoh, Pedro Almodóvar, Wong Kar-wai, Action Heroines, and national packs for Korea, Japan, Hong Kong, Iran, India, Mexico, Brazil, Nordic, France, Taiwan. Good base — the gaps are **thematic representation packs** and a few **creator filmographies**.

## Proposed flagship packs (curated seed lists)

Years are for TMDB title+year resolution; trim/extend to taste. Aim ~12–16 per pack.

### Black Cinema Essentials  (category: Theme)
Do the Right Thing (1989), Killer of Sheep (1978), Daughters of the Dust (1991), Boyz n the Hood (1991), Eve's Bayou (1997), Malcolm X (1992), Moonlight (2016), 12 Years a Slave (2013), Selma (2014), Fruitvale Station (2013), If Beale Street Could Talk (2018), The Last Black Man in San Francisco (2019), Sorry to Bother You (2018), Pariah (2011).

### Queer Cinema Essentials  (category: Theme)
Paris Is Burning (1990), The Watermelon Woman (1996), Happy Together (1997), Brokeback Mountain (2005), Weekend (2011), Pariah (2011), Tangerine (2015), Carol (2015), The Handmaiden (2016), Moonlight (2016), Call Me by Your Name (2017), God's Own Country (2017), A Fantastic Woman (2017), Portrait of a Lady on Fire (2019).

### Women Behind the Camera  (category: Theme)
The Piano (1993, Campion), A League of Their Own (1992, Marshall), American Psycho (2000, Harron), Lost in Translation (2003, Coppola), The Hurt Locker (2008, Bigelow), Fish Tank (2009, Arnold), Winter's Bone (2010, Granik), Wadjda (2012, Al-Mansour), Selma (2014, DuVernay), The Babadook (2014, Kent), Lady Bird (2017, Gerwig), Portrait of a Lady on Fire (2019, Sciamma), Nomadland (2020, Zhao), The Farewell (2019, Wang).

### Latino & Latin American Voices  (category: Theme — complements the Mexican/Brazilian *national* packs)
Y Tu Mamá También (2001), Amores Perros (2000), City of God (2002), Pan's Labyrinth (2006), Roma (2018), The Motorcycle Diaries (2004), Like Water for Chocolate (1992), Wild Tales (2014), A Fantastic Woman (2017), Birdman (2014), Coco (2017), In the Heights (2021).

### Trans & Nonbinary Stories  (category: Theme)
Tangerine (2015), A Fantastic Woman (2017), The Danish Girl (2015), Boys Don't Cry (1999), Disclosure (2020, doc), Lingua Franca (2019), By Hook or by Crook (2001), Paris Is Burning (1990).

## Proposed creator filmography packs (category: Director / Actor)

- **Barry Jenkins** — Medicine for Melancholy (2008), Moonlight (2016), If Beale Street Could Talk (2018).
- **Jordan Peele** — Get Out (2017), Us (2019), Nope (2022).
- **Ava DuVernay** — Middle of Nowhere (2012), Selma (2014), 13th (2016), A Wrinkle in Time (2018).
- **Ryan Coogler** — Fruitvale Station (2013), Creed (2015), Black Panther (2018), Sinners (2025).
- **Mira Nair** — Salaam Bombay! (1988), Mississippi Masala (1991), Monsoon Wedding (2001), The Namesake (2006).
- **Alfonso Cuarón** — Y Tu Mamá También (2001), Children of Men (2006), Gravity (2013), Roma (2018).
- **Céline Sciamma** — Water Lilies (2007), Tomboy (2011), Girlhood (2014), Portrait of a Lady on Fire (2019), Petite Maman (2021).
- **Mahershala Ali** / **Lupita Nyong'o** / **Oscar Isaac** essentials — actor packs to mirror the existing star packs.

## Other gaps worth a pack

- **Indigenous Cinema** (Smoke Signals 1998, Whale Rider 2002, Atanarjuat 2001, The Rider 2017, Once Were Warriors 1994).
- **Disability on screen, told well** (audit for authentic representation; avoid "inspiration" tropes).
- **African Cinema Gateways** (Touki Bouki 1973, Yeelen 1987, Timbuktu 2014, Atlantics 2019) — currently no Sub-Saharan African national pack.
- **Southeast Asian Cinema** (beyond the HK/Korea/Japan packs).

## How to build

1. Add the chosen packs to `data/suggestion-packs.source.json` (each: `slug`, `title`, `subtitle`, `category`, `sortOrder`, `version`, `provenance`, `movies: [{title, year}]`).
2. `TMDB_API_KEY=… node scripts/author-suggestion-packs.mjs` (add `--refresh` to re-resolve, `--dry-run` to preview). This writes `data/suggestion-packs.json` with resolved `tmdbId`/`posterPath`.
3. `node scripts/validate-suggestion-packs.mjs`, then `npm test`.
4. Bump the `data/suggestion-packs.json?v=N` query (constant `PACK_FALLBACK_PATH`) in `app.js` so caches refresh.
5. Optionally `--upload` to push packs to Supabase if remote packs are in use.

## Taste guardrails

- Frame these as **essentials**, not "diversity packs" — the goal is great movies surfaced for everyone, not a labeled sidebar.
- Keep the monochrome, confident pack voice; subtitles describe the films, not the demographic checkbox.
- Verify each title resolves to the intended film (the author script's title+year match can mis-hit on remakes — spot-check posters).
- Revisit the 22-category taxonomy: most of these fit **Theme**; consider whether a dedicated category helps or ghettoizes.
