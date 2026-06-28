# Product instrumentation

Status: **shipped (Jun 2026).**

## Purpose

Several roadmap decisions were waiting for usage evidence, but StackRank had no
analytics layer. This implementation measures the small set of funnels needed
to evaluate ranking, packs, review, sharing, importing, and future first-run
work without collecting movie choices or account identity.

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

Clients can insert rows through a tightly bounded RLS policy but cannot select,
update, or delete telemetry. The table and policy both restrict event names,
property keys, property values, JSON types, and payload size. The browser
sanitizer provides the same first line of defense; the database remains
authoritative.

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
- `import_opened` / `import_completed` — settings entry and bucketed imported
  list size.

Allowed property keys are `source`, `list_size`, `count`, `format`, `outcome`,
and `signed_in`. String values must be short machine tokens; `signed_in` is
boolean. `signed_in` only indicates session state at event time and is never
joined to an auth identity.

## Implementation

- Pure validation/bucketing: `lib/telemetry.js`
- Unit coverage: `tests/telemetry.test.js`
- Browser adapter and event call sites: `app.js`
- Schema/RLS: `supabase/migrations/20260628171913_add_product_events.sql`
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

## Follow-ups

- The first-run quick-start feature should add explicit `quick_start_shown`,
  `quick_start_pack_opened`, and `quick_start_import_opened` events to the
  allowlists when it is implemented.
- Review event volume after 60–90 days and add a retention job if traffic makes
  indefinite raw-event storage unnecessary.
- Only add events that answer a named product decision. Do not turn this into
  exhaustive click tracking.
