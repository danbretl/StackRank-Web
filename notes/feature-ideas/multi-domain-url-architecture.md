# Multi-domain URL architecture

Status: **Movies URL shipped to production (2026-06-29).**

## Decision

StackRank categories use path-based canonical URLs on the existing `www` origin:

- `https://www.stackrankapp.com/movies`
- `https://www.stackrankapp.com/tv-shows`
- `https://www.stackrankapp.com/video-games`
- `https://www.stackrankapp.com/books`
- `https://www.stackrankapp.com/board-games`

The root URL is reserved for a future StackRank-wide home and category picker.
Until a second category exists, Vercel temporarily redirects `/` to `/movies`
with HTTP 307. `/movies` is rewritten internally to the current static
`index.html`, so the browser retains the canonical URL.

Paths were chosen instead of category subdomains because they keep rankings,
queues, Share Studio preferences, and Supabase sessions on one browser origin.
They also allow one account to move between future categories without another
origin migration. Vercel rewrites leave open the option of serving categories
from separate deployments later.

## Movies migration

The repository-side setup consists of:

1. `vercel.json`: temporary `/` redirect, `/movies` rewrite, and no-trailing-slash
   canonicalization.
2. `index.html`: `/movies` canonical and Open Graph URL.
3. `lib/auth.js`: production and route-aware preview callbacks return to
   `/movies`; root-based localhost and the GitHub Pages recovery path continue
   to work.
4. `supabase/config.toml`: `/movies` becomes the Site URL, with exact production,
   local, legacy, and Vercel-preview redirect entries.
5. Automated tests: route configuration, auth redirect behavior, and the real
   browser suite loading the app from `/movies`.

No browser-data migration is required. Both old and new production URLs use the
same `https://www.stackrankapp.com` origin, and the existing movie storage keys
remain unchanged.

## Production cutover sequence

The order matters because setting the hosted Supabase Site URL before Vercel
serves `/movies` can send auth fallbacks to a 404.

1. Deploy the repository changes to a Vercel preview.
2. Verify `/` → 307 `/movies`, `/movies` → 200, `/movies/` canonicalization,
   app assets, browser storage, and sign-in redirect parameters.
3. Add `/movies` and the Vercel preview wildcard to the hosted Supabase redirect
   allowlist. Keep the old root URLs during the transition.
4. Deploy the verified commit to production.
5. Change the hosted Supabase Site URL to
   `https://www.stackrankapp.com/movies`.
6. Verify a controlled production magic-link round trip and check canonical/Open
   Graph metadata from the initial HTML response.
7. Keep `/` as a temporary redirect until the cross-category home ships.

## Rollback

If the production route fails, revert the Vercel deployment and restore the
hosted Supabase Site URL to `https://www.stackrankapp.com/`. The old root
redirect entries remain allow-listed during the migration, and no local or
remote ranking records are rewritten, so rollback is data-neutral.

## Production verification

The cutover shipped in commit `d0e7299` and Vercel production deployment
`dpl_88KyxfjDnxUwH9AY4FQCae4TDKku`.

- `https://www.stackrankapp.com/` returns HTTP 307 with `Location: /movies`.
- `https://www.stackrankapp.com/movies` returns HTTP 200 with the static app.
- `https://www.stackrankapp.com/movies/` returns HTTP 308 to `/movies`.
- Initial HTML declares `/movies` as both canonical and Open Graph URL and loads
  `app.js?v=129`.
- Headless Chrome rendered the complete empty-list Movies UI from the root
  entry URL with no page-load errors.
- The hosted Supabase Auth config was read back after a targeted Management API
  update: Site URL is `/movies`, the repository allowlist is live, and the
  unrelated Google/Apple provider flags remain disabled.
- `npm run verify` passed before deployment: 171 unit tests, all function
  checks/tests, pack validation, and all 16 browser flows running through the
  root-to-`/movies` route.

## Requirements before a second category

URL routing alone does not isolate category data. Before Books, TV Shows, or
another category ships:

- introduce a stable category identifier matching the URL slug;
- namespace every localStorage surface by category while retaining a movie-key
  compatibility migration;
- add category scope to Supabase ranking, queue, pack, and share-related data;
- keep global account routes such as `/account`, `/about`, and `/privacy`
  outside category namespaces;
- place category-specific public resources beneath their category, for example
  `/movies/lists/<id>` and `/books/lists/<id>`.
