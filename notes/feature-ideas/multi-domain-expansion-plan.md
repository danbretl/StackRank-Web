# StackRank beyond Movies: architecture, provider research, and launch plan

Status: working plan and implementation record, researched July 13, 2026.

**Direction update, July 16, 2026:** Books is paused as a noindex/device-only experiment because Dan
does not want provider outreach to be a current dependency. Dogs is now the active next-category
initiative and should be built as a comprehensive real product, not a 24–40-breed canary. The
authoritative execution plan is [`dogs-launch-plan.md`](dogs-launch-plan.md).

This is a product and engineering recommendation, not legal advice. Provider terms, prices, and
product policies can change. Before a public or monetized launch, re-read the linked primary
sources and get written clarification anywhere this document says “approval,” “unclear,” or
“confirm.”

## Executive recommendation

Build a family of category-specific StackRank products, not one universal “rank anything” app and
not five copied versions of `app.js`.

The right shape is:

1. One stable Movies application whose existing routes, storage keys, Supabase rows, public links,
   and payloads remain compatible.
2. A small shared, DOM-free core for item identity, binary insertion, review/reorder/undo,
   persistence envelopes, backups, exports, and category-safe routing.
3. A thin adapter per category for catalog search, stored item snapshots, detail fields, packs,
   suggestions, insights, artwork policy, and optional experiences.
4. Separate static documents/routes initially, because this repo has no build system and because a
   premature generic shell would encode Movies assumptions as “universal” abstractions.
5. Additive generic Supabase tables for new categories only. Do not migrate or alter Movies tables
   in place while old cached clients remain in the wild.

Recommended sequence:

| Order | Product | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Dogs | Build a 24–40-breed internal-catalog canary | It forces clean taxonomy, non-poster artwork, ethical copy, and no live catalog dependency. It is the best architecture stress test. |
| 2 | Books | Develop as the first flagship category | Broad appeal and a natural ranking object. A private work-level preview now exists, but provider/artwork policy must be resolved before public sharing or sync. |
| 3 | TV Shows | Build after a provider decision | Product behavior is close to Movies, but TMDB’s current terms create persistence/commercial questions. TVmaze is a viable differently licensed alternative. |
| 4 | Video Games | Build after choosing a paid/licensed catalog | Strong product, complicated identity across releases/platforms, and inconsistent provider terms. |
| 5 | Board Games | Do not start until BGG approves the use in writing | The dominant source requires application registration, restricts modification, and can decline competing products. |

The counterintuitive part is that Dogs should be the first engineering canary while Books remains
the first product with flagship potential. Dogs validates the architecture with a tiny, rights-led
catalog. Books validates whether the cross-category product can carry real depth.

## What was implemented during this planning pass

This working tree includes behavior-preserving groundwork plus a deliberately bounded Books slice:

- `lib/category.js` and `lib/categories/movies.js` make the active category and every browser key
  explicit while preserving all legacy Movies values byte-for-byte.
- The static Movies document declares its category. A route/marker mismatch fails closed instead of
  silently opening Movies storage on an unknown path.
- Auth redirect construction accepts a validated category route, so a future sign-in flow does not
  bounce every category to `/movies`.
- `lib/entity.js`, `lib/rank-session.js`, `lib/ranked-list.js`, and `lib/category-backup.js` provide
  new-domain primitives without migrating the mature Movies payload.
- `/books` is a noindex, local-only vertical slice with Open Library work search, three starter
  shelves, binary insertion, ranking/reorder/remove, recent items, simple “You” stats, and a
  category-bound backup/restore flow.
- `books-search` is a server-side Open Library proxy with origin and publishable-key checks, query
  bounds, rate limiting, a short in-instance cache, an identified `User-Agent`, and a minimal
  normalized response. It does not return descriptions or raw provider blobs.
- The Books preview has no account sync, public snapshots, recommendation service, or raster image
  export. Those omissions are provider-policy gates, not unfinished buttons.
- Unit tests cover category isolation, work identity, merges, backup category checks, rank sessions,
  and Open Library normalization. A real-browser flow covers an empty Books launch, starter ranking,
  mocked search, multiple comparisons, reload persistence, category isolation, and mobile geometry.
- The visual concept is at `multi-domain-assets/books-primary-screen-concept.png`; the implemented
  screen intentionally uses the current StackRank monochrome vocabulary.

This is a vertical slice, not a public Books launch. It proves the new-domain seam while keeping the
license and operational blast radius small.

## Audit: how generalizable Movies is today

### Already strongly reusable

These are genuinely category-independent or very close:

- Binary insertion and midpoint jitter.
- Adjacent-pair review sessions.
- Reorder transaction rules, keyboard movement, no-op detection, and undo concepts.
- “Never lose data” merge semantics: newest snapshot as base, append older-only entities, preserve a
  review path.
- Backup mechanics, ZIP/text utilities, bounded payload checks, and export orchestration.
- Pack progress calculations and the distinction between catalog data and user progress.
- App-destination persistence and much of the Rank / Ranking / You navigation model.
- Search combobox accessibility behavior.
- The general Share Studio concept of descriptors feeding multiple renderers.
- The testing approach: pure ES modules plus deterministic browser flows.

### Reusable only after an adapter boundary

These look generic in the UI but contain important category policy:

- Search result normalization and duplicate detection.
- Details and insight enrichment.
- Suggestions and “inspired by” reasons.
- Queue names and transitions.
- Starter content and packs.
- Artwork dimensions, proxying, lightbox behavior, and rasterization.
- Share sections and provider attribution.
- “Tonight,” which is a Movies-specific decision helper rather than a universal primitive.

### Directly coupled to Movies

- `tmdbId`, `posterPath`, runtime, cast, director, genres, and movie release year assumptions.
- Legacy localStorage keys and the current flat stored-movie payload.
- `rankings`, `movie_lists`, `suggestion_packs`, `pack_progress`, and current `shared_lists` schemas.
- `/s/:slug`, whose payload and renderer assume movies and posters.
- TMDB edge functions and the canvas poster proxy.
- Large parts of `app.js` composition and DOM wiring.
- Share SVG section content, detail panels, Taste signals, Tonight scoring, and recommendation logic.
- Copy such as “Watch next,” “Not for me,” “movie,” and “poster.”

### The main architectural risk

The core algorithm is generic; the product composition is not. A naive copy of `app.js` would ship
quickly once and then make every bug fix, accessibility improvement, backup change, and responsive
repair a five-way merge. A giant config object that tries to make all 11,000+ Movies lines generic
would be the opposite failure: tangled optional branches and category behavior nobody can reason
about.

The safe strategy is a strangler:

- Preserve Movies.
- Extract only proven cross-domain mechanics.
- Build one deliberately small non-Movies route against those mechanics.
- Extract shared UI controllers only after two domains demonstrate the same behavior.

## Target architecture

### Layer 1: immutable category document and route

Every static category document declares one immutable category id. Route resolution must agree with
that marker before any storage, auth, or remote data is touched.

Canonical routes:

- `/movies`
- `/books`
- `/tv-shows`
- `/video-games`
- `/board-games`
- `/dogs`

The current root and legacy GitHub Pages subpath remain explicit aliases for Movies only. Never
infer “Movies” merely because a route is unknown.

### Layer 2: shared mechanics

Keep these DOM-free and category-neutral:

```text
category route + descriptor
        |
        +-- entity reference and minimal snapshot
        +-- binary rank session
        +-- list parse / merge / serialization
        +-- review / reorder / undo transactions
        +-- category-bound backup envelope
        +-- bounded export primitives
```

The shared layer should understand `primaryText`, not `title`; `image`, not `poster`; and an entity
reference, not a TMDB id. It should not know what an author, breed group, platform, episode, or game
weight is.

### Layer 3: category adapter

Each category exports a descriptor and explicit capabilities:

```js
{
  id: "books",
  path: "/books",
  labels: { singular: "book", plural: "books", savedList: "Read next" },
  identity: { entityType: "work", provider: "openlibrary" },
  artwork: { kind: "cover", aspectRatio: 2 / 3 },
  capabilities: {
    accountSync: false,
    publicSnapshots: false,
    rasterArtworkExport: false,
    liveSuggestions: false
  },
  catalog: { search, normalizeSearchResult, detail },
  product: { packs, insights, queueTypes, detailSections }
}
```

Capabilities must fail closed. Adding a share button should require a provider-policy decision, not
inherit permission from Movies.

### Layer 4: category composition

The shell may eventually share header/nav, accessible search controller, comparison controller,
ranking renderer, settings/backup controller, and responsive tokens. Do not make one universal
detail pane, one universal “You” page, or one universal recommendation engine.

Good shared UI seams:

- `SearchComboboxController(adapter)`
- `ComparisonController(rankSession, renderer)`
- `RankedListController(storage, rowRenderer)`
- `BackupController(category, surfaces)`
- common nav/header/footer primitives

Category-owned composition:

- Books: author, publication work/edition, genre/subject, length, series.
- Dogs: breed aliases, origin, group/taxonomy provenance, image credit; no suitability claims.
- TV: show status, years, network/streamer, seasons.
- Video games: concept vs release, platform, developer/publisher, play modes.
- Board games: base game vs expansion, player count, play time, designer, mechanics.

### Layer 5: provider boundary

Every provider adapter should return a normalized, bounded result and record:

```text
provider id
provider entity id
provider entity type
fetchedAt
metadata provenance
artwork provenance
policy version/review date
```

Do not store raw API responses. Store the minimum passive snapshot needed to render a user’s list.
Keep mutable enrichment in a cache that can be expired or purged separately from user decisions.

### Entity model

New domains use:

```json
{
  "entityRef": {
    "domain": "books",
    "type": "work",
    "source": "openlibrary",
    "id": "OL893415W"
  },
  "snapshot": {
    "primaryText": "Dune",
    "secondaryText": "Frank Herbert",
    "year": 1965,
    "image": {
      "url": "https://…",
      "alt": "Dune cover",
      "assetId": "openlibrary-cover:11481354"
    }
  },
  "rankedAt": "…",
  "comparisons": 2
}
```

Why both reference and snapshot: a provider id makes identity stable, while a small snapshot keeps a
personal ranking legible if a provider is briefly down. Artwork URLs must still follow provider
retention rules; a snapshot is not a blanket right to persist or redistribute content.

Do not migrate the existing flat Movies payload merely for aesthetic consistency. Compatibility is
more valuable than a uniform schema.

### Persistence and Supabase migration

Local storage for every new domain is namespaced:

```text
stackrank:<category>:ranking:v1
stackrank:<category>:queues:v1
stackrank:<category>:pack-progress:v1
stackrank:<category>:share-options:v1
stackrank:<category>:app-destination:v1
```

Movies retains every current legacy key.

When a second category is ready for account sync, add new tables instead of altering existing ones:

| Table | Primary key | Purpose |
| --- | --- | --- |
| `category_rankings` | `(list_id, category)` | New-domain ranking snapshots |
| `category_lists` | `(list_id, category, list_type)` | Read/play/curious/hidden queues |
| `category_pack_progress` | `(list_id, category)` or `(list_id, category, pack_id)` | Category pack progress |
| `category_shared_lists` | slug plus unique `(list_id, category)` as appropriate | New public snapshots |

Keep `list_id = 'user:' || auth.uid()` and RLS predicates using `(select auth.uid())`. Preserve the
existing payload limits or make stricter category-specific limits. New shared links should be
`/s/:category/:slug`; preserve `/s/:slug` as Movies forever.

Do not create a global catalog table until a real operational need exists. User ranking rows can
embed bounded snapshots; provider indexes can have their own retention and purge lifecycle.

### Backup evolution

- Continue accepting and producing the current Movies backup format.
- New private previews use a category-bound envelope and reject another category’s file.
- A future account-wide backup v2 can contain a `categories` map, with each category’s schema
  version and provider provenance.
- Restores must never make an older Movies client interpret a new-domain entity as a movie.

### Artwork is a separate permission surface

Treat these as different actions:

1. Hotlink artwork in a live UI.
2. Cache artwork briefly.
3. Cache artwork indefinitely.
4. Proxy artwork through StackRank.
5. Store artwork in a shared snapshot.
6. Composite artwork into a generated PNG.
7. Redistribute that PNG or ZIP.

A provider that permits (1) does not automatically permit (4)–(7). Every category needs an artwork
ledger and purpose-level launch gates.

## Domain research and product plans

### Books

#### Product definition

Rank works: the conceptual book, not a particular ISBN/format/cover edition. A user generally means
“Dune” rather than one publisher’s 2010 paperback when comparing favorites.

Retain edition provenance as optional metadata so search by ISBN can resolve to a work and so the UI
can explain which cover is shown. Future users who truly want an “editions” collection should get a
separate mode, not identity instability in the primary ranking.

#### Provider recommendation

Open Library is the best MVP source, with conditions:

- The official API guide says the live APIs are free, public, low-volume services for human-facing
  discovery and are not intended as a high-traffic third-party backend.
- Unidentified requests are limited to 1 request/second; identified requests get 3/second.
- For bulk/high-traffic use, Open Library asks developers to use its free monthly data dumps or
  contact it.
- The licensing page says the Internet Archive asserts no new rights over database material, while
  explicitly warning that contributions may carry existing rights issues.

Therefore:

- Private alpha: identified server proxy, minimal search response, bounded rate, short cache.
- Public beta: contact Open Library with the product description and intended traffic; ask
  specifically about persistent user-list snapshots and cover display.
- Scale path: ingest monthly work/author/edition dumps into a small internal search index, then use
  live calls only for low-volume refresh. Keep catalog updates separate from user data.
- Public sharing and raster cover exports remain off until artwork rights are understood.

Google Books is not the default. Its API-specific terms say an app may not charge users without a
separate agreement, and the general Google API terms prohibit building permanent copies/databases
or caching longer than response headers allow unless the rights owner/law permits it. That conflicts
with StackRank’s durable, shareable list model.

#### Backend

Near term:

- `books-search`: query Open Library search once per human input, return work key/title/authors/first
  publication year/cover id only.
- Add `books-detail` only after deciding which fields are essential. Avoid raw descriptions because
  they are user-contributed text and unnecessary for ranking.
- Do not proxy covers merely to work around canvas CORS. That would expand the artwork use and
  retention surface.

Scale:

- Monthly dump ingestion job.
- Postgres/full-text or a compact dedicated search index over work title, normalized author, aliases,
  identifiers, and selected edition ISBNs.
- A `provider_catalog_version` record so each normalized result states which dump produced it.
- Incremental correction workflow for duplicate works and merged Open Library ids.

#### Product translation

| Movies concept | Books version |
| --- | --- |
| Watch next | Read next |
| Not for me | Not for me or Not interested |
| Movie packs | Reading shelves / book packs |
| Runtime | Page count only when edition-specific; avoid pretending it belongs to a work |
| Cast & crew | Authors, translators, illustrators (edition-aware) |
| Eras | Publication eras |
| Genres | Subjects, normalized conservatively |
| Tonight | “What should I read next?” only after length/format/availability are modeled honestly |

Promising packs: modern essentials, short books/big impact, genre gateways, translated fiction,
memoir, banned/challenged classics with careful sourcing, Booker/Pulitzer winners, and “one great
book from each decade.”

Taste signals: recurring authors, publication eras, broad subjects, translated works, series, and
fiction/nonfiction. Do not infer sensitive beliefs or personal traits from a reading list.

#### Books launch gate

- Written provider alignment or an internal dump-backed index.
- Work/edition resolver with duplicate/merge tests.
- A cover-rights decision for live display, public snapshots, and raster export separately.
- Sync tables and no-loss merge tests if sign-in is enabled.
- Provider outage and catalog-removal behavior.
- Updated privacy, credits, takedown contact, and data export.

### Dogs (dog breeds/types)

#### Product definition

V1 is “rank the dog breeds/types you love,” not “which dog should your family buy?” and not a ranking
of individual dogs. That distinction is important: breed is not a reliable deterministic predictor
of an individual dog’s behavior, and product copy must not turn a playful preference list into
medical, safety, temperament, or housing advice.

Suggested language:

- “Which breed are you more drawn to?”
- “Favorite breeds”
- “Curious about” / “Skip for now”

Avoid:

- “Best with children,” “safe,” or “right for apartments” as scored facts.
- Universal intelligence, aggression, or trainability rankings.
- Health guarantees.
- Treating kennel-club recognition as one universal truth.

The 2022 Science paper on dog genomics and behavior is a useful editorial guardrail: breed explains
only part of behavioral variation and is a poor predictor of an individual dog’s behavior. Link
prominent educational copy rather than converting contested traits into taste scores.

#### Catalog recommendation

Use a versioned internal catalog, not a live consumer dog API:

- Base identity on the Vertebrate Breed Ontology (VBO), which provides stable computable breed
  concepts and is CC BY 4.0.
- Start with a deliberately curated 24–40-breed slice across sizes, shapes, histories, and common
  recognition groups.
- Store aliases and the exact VBO release used.
- Manually audit one or more Wikimedia Commons/Openverse images per breed. Record creator, source
  URL, exact license, attribution text, changes, and whether derived/raster export is permitted.
- Include a “mixed breed” concept as a first-class user choice, while recognizing it is not one
  biological breed and should not be represented with a single stereotyped look.

Do not base the product on AKC scraping, the Stanford Dogs/Dog CEO image corpus, or a generic dog API
whose image provenance cannot support public composites. TheDogAPI may be useful commercially only
after reviewing its current paid terms; it should not be the identity or rights foundation.

#### Why Dogs is the best canary

- No provider latency is required for search.
- Identity is not title+year and art is not poster-shaped by necessity.
- The catalog has multiple taxonomies and aliases.
- Details need citations and ethical qualifiers.
- The category does not support Tonight, cast/crew, or movie-like suggestions.
- A rights ledger is unavoidable, which forces the platform to model artwork correctly.

#### Product translation

- Rank Bar searches curated breed names and aliases.
- Starter packs: small companions, working histories, sporting breeds, sighthounds, ancient breeds,
  distinctive coats, “breeds you may not know.” Avoid packs that imply superiority or suitability.
- Detail pane: identity/aliases, geographic/historical origin with citations, recognition taxonomy,
  broad physical description, and photo credit. Any care/health content needs veterinary-quality
  sourcing and should probably remain out of v1.
- You/Taste: preferred size silhouettes, historical groups, coat families, and origins, expressed as
  patterns in this list—not claims about the user or dogs.
- Sharing is especially fun if every image’s license permits derivative collage/export and the
  attribution is carried into the export or a paired credits page.

#### Dogs launch gate

- VBO release pinned and attribution included.
- Internal catalog review for duplicates, aliases, and culturally/registry-specific names.
- Per-image rights ledger complete; export purpose permitted.
- Editorial review of every trait-like statement.
- Mixed-breed representation reviewed.
- No suitability or behavioral prediction language.

### TV Shows

#### Product definition

Rank series, not seasons or episodes, in v1. Keep series identity stable across reboots by treating a
reboot as a different provider id and showing start year/network for disambiguation.

Later modes may rank seasons within one show, but combining series and seasons in one list creates
ambiguous comparisons and details.

#### Provider paths

**TMDB:** technically the lowest-effort path because StackRank already has the proxy, attribution,
image handling, and domain knowledge. However, current TMDB API terms prohibit caching information
longer than six months, require purging cached content after termination, prohibit derivatives of
TMDB content, and require a written commercial agreement for commercial use. The same terms now
deserve a review for the existing Movies app, especially persistent stored snapshots and share
collages. “Already integrated” is not the same as “cleared for another product.”

**TVmaze:** strongest fallback/alternative. Its official API is CC BY-SA, permits use for any
purpose with attribution/share-alike compliance, supports local show-index caching, allows image
hotlinking and recommends image caching, and documents at least 20 calls per 10 seconds per IP.
Before adoption, determine exactly how ShareAlike applies to StackRank’s normalized catalog and
public snapshots, and separately review rights in contributed images.

**TheTVDB:** metadata licensing is currently free below $50k annual company revenue with attribution,
then $1,000/year up to $250k and higher tiers above that. Its terms explicitly say the API license
does not grant rights to display images/trailers/programming, making it a poor artwork foundation
unless separate rights are secured.

Recommendation: ask TMDB for written confirmation/commercial terms covering the current Movies app
and prospective TV product. In parallel, prototype a TVmaze adapter and document the CC BY-SA
implications. Do not build on TheTVDB images.

#### Product translation

- Queue: Watch next / Not for me.
- Detail: status, run years, genres, network/streamer, creators/cast, typical episode runtime, season
  count. “Where to watch” is a separate licensed/region-sensitive data problem; omit it initially.
- Packs: completed classics, current essentials, miniseries, animation, international series,
  sitcom gateways, prestige drama, one-season wonders.
- Taste: eras, countries/languages, genres, creators/cast, format (limited series/sitcom/procedural).
- Tonight can return only after episode length and watch status are modeled. Picking a whole series
  for tonight is not the same decision as picking a movie.

### Video Games

#### Product definition

Rank the game concept in v1, not every platform release. Retain release/platform relationships for
disambiguation and details. Remakes that are substantively new games should be separate; ports and
regional releases generally should not be.

This needs an explicit identity policy because providers disagree about editions, DLC, expansions,
remasters, bundles, and episodic releases.

#### Provider paths

**MobyGames:** currently the clearest commercial path. Its API documentation advertises hobby and
commercial access; the currently observed plans were roughly $9.99/month Hobby (noncommercial),
$99.99/month Bronze (commercial, 1 request/second), and $499.99/month Silver, with cover access and
local caching encouraged on commercial tiers. Confirm exact current pricing, fields, image rights,
retention, and export rights before purchase.

**RAWG:** feature-rich and currently advertises a $149/month Business plan with commercial use and
50,000 requests/month. The same official page also contains older/conflicting text suggesting free
commercial use below traffic thresholds. Get the applicable terms in writing. It also disclaims
ownership of contributed images/data, which makes raster redistribution a separate risk.

**IGDB:** excellent technical coverage, but it is governed by Twitch’s developer agreement. The
default agreement prohibits storing Twitch content/program materials except with written
authorization, controlled rights, or a 24-hour cache without third-party sharing. Durable rankings
and snapshots therefore require a partnership or written permission; the free API is not enough.

Recommendation: choose MobyGames if a paid contract confirms persistent normalized snapshots and
cover display/export. Treat RAWG as a second bidder after written clarification. Do not use IGDB for
the durable product without a separate agreement.

#### Product translation

- Queue: Play next / Not for me; optionally Finished/Backlog later, but do not turn v1 into a game
  collection tracker.
- Detail: first release, platforms, developer/publisher, genres, modes, franchise, approximate
  length only if licensed from a reliable source.
- Packs: console generations, indie gateways, co-op, handheld classics, narrative games, strategy,
  short games, landmark releases.
- Taste: eras, platforms, genres, developers, modes, franchises. Keep review scores out, matching
  the Movies product’s decision to avoid provider ratings.
- Tonight-like experience: “What should I play next?” needs available platform, desired session
  length, solo/co-op, and installed/owned state. It is a separate phase.

### Board Games

#### Product definition

Rank base games only in v1. Exclude expansions, accessories, promos, and reimplementations until an
identity hierarchy exists. Show year/designer and perhaps player count to disambiguate same-title
games.

#### Provider reality

BoardGameGeek is the dominant source, but it is a partnership decision, not an open-API shortcut:

- Nearly all API use requires registered application approval and an application token.
- The default license is strictly noncommercial.
- Commercial licenses are case-by-case; BGG may decline an app it believes competes with or harms
  its interests.
- Public products require “Powered by BGG” attribution.
- The terms say API data may not be modified, which may conflict with normalization, derivative
  suggestion reasons, and aggregated insight/share sections.
- Commercial pricing and thresholds are decided case-by-case, although current guidance describes
  provisional free thresholds for small paid/ad-supported products.

Recommendation: prepare a two-page product/use proposal and ask BGG about:

1. Commercial approval for a preference-ranking app.
2. Storing normalized base-game snapshots in user rankings.
3. Excluding expansions and normalizing names.
4. Derived packs, suggestions, and taste summaries.
5. Image display, caching, public share collages, and PNG exports.
6. Required attribution placement.
7. Traffic, refresh, purge, and takedown obligations.

Do not write the adapter until those answers are favorable.

#### Product translation

- Queue: Play next / Want to try / Not for me. “Want to try” may fit better than ownership.
- Detail: designers, year, player count, play time, weight/complexity only if licensed, mechanics,
  categories, base-game relationships.
- Packs: two-player, party, gateway, co-op, legacy/campaign, abstracts, modern classics, short play,
  solo-capable.
- Taste: mechanics, player counts, eras, designers, complexity bands. Avoid using BGG ratings.
- Decision helper: group size, time available, desired interaction, and complexity—only after data
  permissions are clear.

## Provider decision matrix

Ratings are product-fit judgments, not legal conclusions.

| Domain/source | Live access | Durable metadata | Artwork/export | Commercial path | Current recommendation |
| --- | --- | --- | --- | --- | --- |
| Books / Open Library | Free, low-volume, 1 rps or 3 rps identified | Prefer monthly dumps/internal index at scale; contribution rights caveat | Cover rights need separate review; no raster export in preview | Mission alignment/contact advisable | Best Books MVP, conditional launch |
| Books / Google Books | Free quota | Permanent copies/database generally restricted | Provider/content-owner restrictions | Charging needs written permission | Reject as durable primary catalog |
| TV / TMDB | Existing integration | Max six-month cache; purge on termination | Derivatives restriction needs review | Written commercial agreement | Ask for written coverage; audit Movies |
| TV / TVmaze | Free public API | Local cache/index supported | Hotlink/cache documented; contributed image rights still review | CC BY-SA, enterprise available | Best technical fallback |
| TV / TheTVDB | Licensed API | Contract dependent | API license explicitly excludes image rights | Revenue-tier pricing | Metadata-only candidate, not artwork |
| Games / MobyGames | Paid plans | Commercial caching appears supported | Confirm cover/export clauses | Clear paid tiers | Preferred bidder |
| Games / RAWG | Free/Business page conflicts | Confirm in writing | Disclaims ownership; exports risky | $149/month Business advertised | Secondary bidder only after clarification |
| Games / IGDB | Free noncommercial API | Default Twitch terms allow only 24h cache without permission | Same retention/redistribution constraint | Partnership/written permission | Reject absent agreement |
| Board games / BGG | Application approval/token | Contract-specific; no-modification language | Explicit approval required | Case-by-case, can decline competitors | Blocked on written approval |
| Dogs / VBO + curated images | Download/internal | Versioned catalog under CC BY 4.0 | Per-image license ledger | No live API fee | Best controlled canary |

## Important work areas beyond the original questions

### 1. Editorial operations

Packs, aliases, merge decisions, descriptions, and source corrections become a catalog operation.
Define who reviews changes, how often catalogs update, and how a bad item is corrected without
damaging user rankings.

### 2. Rights and takedown operations

Maintain a provider and image ledger, a public contact, a takedown procedure, and the ability to
remove/replace artwork while preserving the user’s underlying entity/rank.

### 3. Provider exit strategy

Every adapter needs a plan for price increases, termination, or API shutdown. Stable internal entity
references should allow provider mapping, but do not create cross-provider ids until a migration is
actually required.

### 4. Taxonomy governance

Subjects, genres, breeds, platforms, game editions, expansions, series, and reboots all require
category-specific identity rules. Write the rules before loading a large catalog.

### 5. Internationalization

Books and TV have translated titles; games have regional releases; breeds have aliases across
registries/languages. Store source ids and aliases separately from the user-facing preferred label.
Do not use normalized English text as primary identity.

### 6. Cross-category product and navigation

The future root should explain the family and route to categories. It should not silently combine
rankings. Account settings may become global, but category data remains visibly separate. Decide
whether one display name, one sign-in, and one account-wide backup span all categories.

### 7. SEO and public sharing

Static generic metadata is adequate for private previews, not rich public lists. Per-list social
cards eventually require server rendering or edge-generated metadata. Provider rules may prohibit
putting some artwork in those cards.

### 8. Analytics and privacy

Add category as an allowlisted coarse telemetry property. Continue excluding titles and ids. Avoid
sensitive inferences from reading, media, or breed preferences. Update the privacy page before each
provider goes live.

### 9. Cost and performance budgets

Track per-search provider calls, enrichment fan-out, image bandwidth, catalog-index size, and share
render cost. A cheap search API can become expensive when details, suggestions, and exports multiply
requests.

### 10. Accessibility of non-poster media

Book covers, square board-game boxes, game key art, and dog photography need different crop rules.
Every stored image needs useful alt text and a fallback that does not depend on color.

### 11. Abuse and content policy

User-provided list names/display names and public links need moderation/takedown behavior. Provider
terms may also prohibit offensive contexts even when the ranking data itself is benign.

### 12. Data quality observability

Track provider error rate, zero-result rate, duplicate selection/merge rate, broken artwork rate,
catalog freshness, and restore failures without recording sensitive queries or ranked ids in product
telemetry.

## Phased roadmap

### Phase 0 — preserve Movies and establish seams (implemented here)

- Explicit Movies category descriptor and fail-closed route resolution.
- Exact compatibility tests for all local/session storage keys.
- Category-aware auth redirect helper.
- Generic entity, rank-session, list-merge, and category-backup modules.
- No migration of Movies remote/local payloads.

Exit gate: full Movies verification stays green and old storage remains readable/writable.

### Phase 1 — Dogs canary (roughly 1–2 focused engineering weeks plus content work)

- Pin VBO release and curate 24–40 breeds.
- Create image/attribution ledger and automated validation.
- Build adapter against shared rank/persistence/backup core.
- No auth initially; exercise artwork ratios, aliases, details, packs, and safe Taste signals.
- Use it to decide which Books UI controllers are truly common.

Exit gate: zero Movies regression, complete rights ledger, stable identities, responsive browser
suite, editorial approval.

### Phase 2 — Books private alpha (vertical slice implemented; 1–3 more weeks)

- Exercise current `/books` with real devices and a small invited group.
- Add robust search empty/error states, duplicate work handling, cancel/undo, keyboard reorder, and
  parity accessibility.
- Contact Open Library and decide live-proxy vs dump-index launch architecture.
- Decide cover policy.

Exit gate: provider decision, no-loss restore, work/edition contract tests, provider-outage mode,
and no public/sync feature that exceeds approved purposes.

### Phase 3 — shared UI extraction (1–2 weeks)

- Compare Dogs and Books implementations.
- Extract only identical header/nav, combobox, comparison, ranking, and backup controllers.
- Move common visual tokens into a shared category stylesheet without renaming mature Movies CSS.
- Add cross-category contract tests.

Exit gate: one behavior test per shared controller runs against at least two adapters.

### Phase 4 — account sync and public family shell (2–4 weeks)

- Add generic new-domain Supabase tables/migrations and RLS.
- Add account-wide category discovery/home.
- Add backup v2 while preserving Movies v1.
- Enable sync one category at a time.
- Build `/s/:category/:slug` only for providers that permit public snapshots/artwork.

Exit gate: old cached Movies clients still function; rollback leaves all user data intact; category
rows cannot cross-read under RLS.

### Phase 5 — Books public beta (2–4 weeks after provider gate)

- Internal search index if needed.
- Curated packs and conservative Taste signals.
- Optional Read next queue.
- Provider-compliant sharing, possibly text-only first.
- SEO/social metadata strategy.

### Phase 6 — TV, games, board games

- TV after TMDB/TVmaze decision.
- Games after paid provider contract and identity spec.
- Board games only after BGG approval.

Effort estimates exclude provider negotiations, legal review, and large-scale pack authoring; those
can dominate engineering time.

## Acceptance gates for every category

### Identity and data

- Provider-qualified stable id; no title-only identity.
- Written rules for editions/releases/expansions/reboots/aliases.
- Duplicate and merge fixtures.
- Minimal stored snapshot and documented provider provenance.
- Provider deletion/change behavior.

### Persistence

- Unique category keys.
- No read/write of another category’s local data.
- No-loss local/remote merge tests before sync.
- Category-bound backup/restore and corrupt-file handling.
- Existing Movies data survives upgrade, rollback, and older cached clients.

### Provider policy

- Terms reviewed with date and source links.
- Commercial status documented.
- Metadata retention/purge documented.
- Artwork hotlink/cache/proxy/share/raster permissions documented separately.
- Required attribution in live UI and exports.
- Provider exit/takedown path tested.

### Product and ethics

- Ranking object is clear to users.
- Category copy and queues are native, not mechanically renamed Movies language.
- Suggestions and insights have honest evidence.
- No sensitive or harmful inference.
- Domain-specific decision helpers are optional, not forced into a universal mold.

### Quality

- Unit tests for identity, normalization, ranking, merges, backup, and policy gates.
- Desktop, iPad, phone portrait, and phone landscape smoke.
- Keyboard and screen-reader states for search/comparison/reorder.
- Provider outage, storage failure, malformed response, and broken image smoke.
- Full `npm run verify` plus a category-specific production smoke before launch.

## Decisions to make next

1. Is the long-term product commercial, donation-supported, or purely noncommercial? Provider
   answers depend on this even before revenue exists.
2. Should Dogs be a playful standalone experiment before Books alpha, or should it remain an
   internal architecture fixture?
3. Is a text-only public Books list acceptable if cover redistribution remains unclear?
4. Should Books rank works only forever, or later support a separate edition-ranking mode?
5. Is the current Movies TMDB use covered by an existing commercial/written agreement? If not,
   contact TMDB before expanding the same model.
6. Is StackRank willing to pay roughly $100–$150/month for a games provider at launch?
7. Should cross-category sign-in wait until two categories have meaningful retention, or be part of
   the first Books beta?

## Visual fidelity ledger for the Books slice

Reference: `multi-domain-assets/books-primary-screen-concept.png`.

1. Preserved the centered Rank / Ranking / You navigation and quiet category switch/settings area.
2. Preserved the large editorial search treatment and monochrome double-keyline language.
3. Preserved three four-item discovery shelves with real book-cover proportions.
4. Adapted the concept’s populated “Recently ranked” state into an empty-state “Start somewhere
   good” block; Recent appears only after an actual ranking so the preview does not fake user data.
5. Added explicit “private/device-only/Open Library” disclosure absent from the concept because it is
   a launch-safety requirement.

The focused browser harness is the rendering method because the in-app browser controller was not
available in this environment. It captures the exact 1586×992 concept viewport plus a 390×844 touch
comparison. The first rendered pass exposed slow/lazy comparison covers; starter/search/comparison
images now load eagerly while lower-priority list imagery remains lazy.

## Primary sources

Accessed July 13, 2026 unless otherwise noted.

### Books

- [Open Library API guide and rate limits](https://openlibrary.org/developers/api)
- [Open Library licensing](https://openlibrary.org/developers/licensing)
- [Open Library bulk data](https://openlibrary.org/data)
- [Google Books API terms](https://developers.google.com/books/terms)
- [Google APIs terms, content retrieval and caching](https://developers.google.com/terms)

### TV

- [TMDB API terms of use](https://www.themoviedb.org/api-terms-of-use)
- [TVmaze API, caching, rate limits, images, and CC BY-SA licensing](https://www.tvmaze.com/api)
- [TheTVDB API and data licensing](https://thetvdb.com/api-information)
- [TheTVDB terms, including separate image-rights warning](https://thetvdb.com/tos)

### Video games

- [MobyGames API documentation](https://www.mobygames.com/info/api/)
- [RAWG API plans and terms](https://rawg.io/apidocs)
- [IGDB API documentation](https://api-docs.igdb.com/)
- [Twitch Developer Services Agreement](https://www.twitch.tv/p/en/legal/developer-agreement/)

### Board games

- [BGG XML API terms](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use)
- [Using the BGG XML API, registration and licensing](https://boardgamegeek.com/using_the_xml_api)
- [BGG commercial use guidance](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use)

### Dogs

- [Vertebrate Breed Ontology repository](https://github.com/monarch-initiative/vertebrate-breed-ontology)
- [VBO OBO Foundry record and CC BY 4.0 license](https://obofoundry.org/ontology/vbo.html)
- [VBO standardization paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC12103836/)
- [Ancestry-inclusive dog genomics challenges popular breed stereotypes](https://www.science.org/doi/10.1126/science.abk0639)
- [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
