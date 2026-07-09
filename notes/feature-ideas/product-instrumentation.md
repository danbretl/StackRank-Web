# Product instrumentation

Status: **shipped (Jun 2026; public share-link events added Jul 2026).**

## Purpose

Several roadmap decisions were waiting for usage evidence, but StackRank had no
analytics layer. This implementation measures the small set of funnels needed
to evaluate ranking, packs, review, sharing, public shared-list links,
importing, and future first-run work without collecting movie choices or
account identity.

## What ships

### Vercel Web Analytics

Web Analytics is enabled on the Vercel Hobby project and injected only on
`www.stackrankapp.com`. It provides first-party, cookie-free aggregate traffic
reporting.

Vercel custom events are not available on Hobby. Product events therefore use
the bounded Supabase stream below rather than requiring a paid plan or adding a
third-party tracker.

### Anonymous product events

`public.product_events` stores:

- an allowlisted `event_name`;
- a random UUID created in memory for that page lifetime;
- allowlisted aggregate properties;
- a server-generated timestamp.

There is deliberately no user id, email, movie title, TMDB id, URL, free-form
error message, or durable device identifier. Counts are bucketed (`2_4`,
`10_24`, `100_plus`) instead of storing exact list sizes.

Collection only runs on `www.stackrankapp.com`, honors browser Do Not Track and
Global Privacy Control, and stops after 80 events in one page lifetime.
Localhost, previews, and the legacy GitHub Pages origin do not write events.
Production visits with `?debug=1` and browsers reporting
`navigator.webdriver === true` are also excluded so developer QA and automation
do not contaminate product decisions. Use `?debug=1` for every manual
production smoke.

Clients can insert rows through a tightly bounded RLS policy but cannot select,
update, or delete telemetry. The table and policy both restrict event names,
property keys, property values, JSON types, and payload size. The browser
sanitizer provides the same first line of defense; the database remains
authoritative.

Raw product events are retained for 180 days. A Supabase Cron job named
`stackrank-product-events-retention` runs daily and deletes older rows, so the
clean analysis cutoff (`2026-06-29 18:44:36+00`) is still useful for historical
queries until those rows naturally age out. A database trigger rejects more than
500 rows for one `session_id`; this is a cheap loop brake, not a complete flood
defense because anonymous clients can still mint new session UUIDs.

## Event dictionary

- `session_started` — app initialization finished; distinguishes empty and
  returning list states.
- `ranking_started` / `ranking_completed` / `ranking_canceled` — source,
  bucketed list size, and bucketed comparison count.
- `review_started` / `review_completed` — bucketed queue/list/swap counts and
  completed vs ended outcome.
- `pack_opened` / `pack_browser_opened` — pack entry-surface use without
  recording the pack slug.
- `pack_rank_all_started` / `pack_rank_all_stopped` — bucketed remaining count
  and completed/ended/canceled/failed outcome.
- `share_opened` / `share_exported` — list-size bucket and export format.
- `share_link_published` / `shared_list_viewed` — adoption of public
  read-only snapshot links without recording the slug, URL, title, TMDB id, or
  owner identity.
- `import_opened` / `import_completed` — settings entry and bucketed imported
  list size.
- `quick_start_shown` / `quick_start_pack_opened` /
  `quick_start_import_opened` — first-run exposure and path adoption without
  recording titles, pack slugs, or a durable user identity.
- `taste_explorer_opened` / `taste_lens_opened` — adoption of the native
  explorer and its evidence-to-ranking loop without recording which genre,
  decade, director, or cast member was selected.
- `tonight_opened` / `tonight_picked` — adoption of the "Pick something for
  tonight" decision helper. `tonight_opened` carries the bucketed Watch next
  size; `tonight_picked` fires when a pick is committed ("Watch this") with
  `source` = `tonight_mood` or `tonight_no_mood` (whether a vibe was applied)
  and the bucketed queue size. The mood text itself, the chosen movie, and the
  interpreted vibe signals are never recorded. Ranking from a tonight pick
  reuses `ranking_started` with `source` = `tonight`.

Allowed property keys are `source`, `list_size`, `count`, `format`, `outcome`,
and `signed_in`. String values must be short machine tokens; `signed_in` is
boolean. `signed_in` only indicates session state at event time and is never
joined to an auth identity.

## Implementation

- Pure validation/bucketing: `lib/telemetry.js`
- Unit coverage: `tests/telemetry.test.js`
- Browser adapter and event call sites: `app.js`
- Schema/RLS: `supabase/migrations/20260628171913_add_product_events.sql`
- FTUE allowlist/RLS extension:
  `supabase/migrations/20260628225636_add_quick_start_events.sql`
- Taste Explorer allowlist/RLS extension:
  `supabase/migrations/20260629012754_add_taste_explorer_events.sql`
- Retention/flood posture:
  `supabase/migrations/20260708064357_product_events_retention_and_flood_limit.sql`
- Public share-link allowlist/RLS extension:
  `supabase/migrations/20260708104134_20260708101029_add_shared_lists.sql`
- Tonight picker allowlist/RLS extension:
  `supabase/migrations/20260709001734_add_tonight_events.sql`
- Vercel pageview injection: `initVercelWebAnalytics()` in `app.js`

Telemetry failures are non-blocking and only log in `?debug=1`; product actions
must never wait on analytics.

## Useful queries

Daily event volume:

```sql
select
  date_trunc('day', occurred_at) as day,
  event_name,
  count(*) as events,
  count(distinct session_id) as sessions
from public.product_events
where occurred_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc, 2;
```

Empty-session activation:

```sql
with sessions as (
  select
    session_id,
    bool_or(event_name = 'session_started' and properties->>'source' = 'empty') as started_empty,
    bool_or(event_name = 'ranking_completed') as ranked_one,
    bool_or(
      event_name = 'ranking_completed'
      and properties->>'list_size' in ('2_4', '5_9', '10_24', '25_49', '50_99', '100_plus')
    ) as reached_two
  from public.product_events
  where occurred_at >= now() - interval '30 days'
  group by session_id
)
select
  count(*) filter (where started_empty) as empty_sessions,
  count(*) filter (where started_empty and ranked_one) as ranked_one,
  count(*) filter (where started_empty and reached_two) as reached_two
from sessions;
```

First-run decision dashboard:

```sql
with session_rollup as (
  select
    session_id,
    min(occurred_at) filter (
      where event_name = 'quick_start_shown'
    ) as exposed_at,
    min(occurred_at) filter (
      where (
        event_name = 'ranking_started'
        and properties->>'list_size' = '0'
      )
      or event_name in (
        'quick_start_pack_opened',
        'quick_start_import_opened'
      )
    ) as first_action_at,
    min(occurred_at) filter (
      where event_name = 'ranking_completed'
      and properties->>'list_size' = '1'
    ) as first_movie_at,
    min(occurred_at) filter (
      where event_name = 'ranking_started'
      and properties->>'list_size' = '1'
    ) as first_comparison_at,
    min(occurred_at) filter (
      where event_name = 'ranking_completed'
      and properties->>'list_size' = '2_4'
    ) as core_aha_at,
    min(occurred_at) filter (
      where (
        event_name = 'ranking_completed'
        and properties->>'list_size' = '2_4'
      )
      or (
        event_name = 'import_completed'
        and properties->>'count' not in ('0', '1')
      )
    ) as useful_list_at,
    min(occurred_at) filter (
      where (
        event_name = 'ranking_completed'
        and properties->>'list_size' = '5_9'
      )
      or (
        event_name = 'import_completed'
        and properties->>'count' in (
          '5_9', '10_24', '25_49', '50_99', '100_plus'
        )
      )
    ) as five_movies_at,
    bool_or(event_name = 'quick_start_pack_opened') as used_starter_pack,
    bool_or(event_name = 'quick_start_import_opened') as used_quick_import,
    count(*) filter (
      where event_name in (
        'ranking_completed', 'pack_opened', 'import_completed'
      )
    ) as meaningful_actions
  from public.product_events
  -- Earlier events include developer QA before explicit QA exclusion shipped.
  where occurred_at >= timestamptz '2026-06-29 18:44:36+00'
  group by session_id
),
exposed as (
  select *
  from session_rollup
  where exposed_at is not null
)
select
  count(*) as exposed_sessions,
  round(100.0 * count(*) filter (where first_action_at is not null)
    / nullif(count(*), 0), 1) as first_action_pct,
  round(100.0 * count(*) filter (where first_movie_at is not null)
    / nullif(count(*), 0), 1) as first_movie_pct,
  round(100.0 * count(*) filter (where first_comparison_at is not null)
    / nullif(count(*), 0), 1) as comparison_started_pct,
  round(100.0 * count(*) filter (where core_aha_at is not null)
    / nullif(count(*), 0), 1) as core_aha_pct,
  round(100.0 * count(*) filter (where useful_list_at is not null)
    / nullif(count(*), 0), 1) as useful_list_pct,
  round(100.0 * count(*) filter (where five_movies_at is not null)
    / nullif(count(*), 0), 1) as five_movies_pct,
  round(100.0 * count(*) filter (where used_starter_pack)
    / nullif(count(*), 0), 1) as starter_pack_pct,
  round(100.0 * count(*) filter (where used_quick_import)
    / nullif(count(*), 0), 1) as quick_import_pct,
  round((
    percentile_cont(0.5) within group (
      order by extract(epoch from (useful_list_at - exposed_at)) / 60
    ) filter (where useful_list_at is not null)
  )::numeric, 1) as median_minutes_to_useful,
  percentile_cont(0.5) within group (
    order by meaningful_actions
  ) as median_meaningful_actions
from exposed;
```

## Follow-ups

- Review FTUE activation on 2026-07-12; extend to 2026-07-28 if fewer than 50
  post-cutover exposed sessions. Use the decision thresholds in
  `first-run-quick-start.md`.
- Review event volume after 60–90 days; if the 180-day raw retention window is
  more than product analysis needs, shorten the Cron job rather than keeping
  old rows indefinitely.
- Only add events that answer a named product decision. Do not turn this into
  exhaustive click tracking.
