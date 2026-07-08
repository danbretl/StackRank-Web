create table if not exists public.shared_lists (
  slug text primary key,
  payload jsonb not null,
  list_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  revoked boolean not null default false,
  constraint shared_lists_slug_format check (slug ~ '^[a-z0-9]{10}$'),
  constraint shared_lists_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint shared_lists_payload_movies_array check (payload ? 'movies' and jsonb_typeof(payload->'movies') = 'array'),
  constraint shared_lists_payload_size check (octet_length(payload::text) <= 1048576)
);

create index if not exists shared_lists_owner_updated_idx
on public.shared_lists (list_id, updated_at desc);

alter table public.shared_lists enable row level security;

grant select on table public.shared_lists to anon;
grant select, insert, update, delete on table public.shared_lists to authenticated;
grant select, insert, update, delete on table public.shared_lists to service_role;

create policy "Anyone can read active shared lists"
on public.shared_lists for select
to anon, authenticated
using (revoked = false);

create policy "User insert own shared lists"
on public.shared_lists for insert
to authenticated
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User update own shared lists"
on public.shared_lists for update
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text))
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User delete own shared lists"
on public.shared_lists for delete
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));

alter table public.product_events
drop constraint product_events_known_name,
add constraint product_events_known_name check (
  event_name = any (
    array[
      'session_started',
      'ranking_started',
      'ranking_completed',
      'ranking_canceled',
      'review_started',
      'review_completed',
      'pack_opened',
      'pack_browser_opened',
      'pack_rank_all_started',
      'pack_rank_all_stopped',
      'share_opened',
      'share_exported',
      'share_link_published',
      'shared_list_viewed',
      'import_opened',
      'import_completed',
      'quick_start_shown',
      'quick_start_pack_opened',
      'quick_start_import_opened',
      'taste_explorer_opened',
      'taste_lens_opened'
    ]::text[]
  )
);

drop policy "Collect bounded anonymous product events" on public.product_events;

create policy "Collect bounded anonymous product events"
on public.product_events for insert
to anon, authenticated
with check (
  event_name = any (
    array[
      'session_started',
      'ranking_started',
      'ranking_completed',
      'ranking_canceled',
      'review_started',
      'review_completed',
      'pack_opened',
      'pack_browser_opened',
      'pack_rank_all_started',
      'pack_rank_all_stopped',
      'share_opened',
      'share_exported',
      'share_link_published',
      'shared_list_viewed',
      'import_opened',
      'import_completed',
      'quick_start_shown',
      'quick_start_pack_opened',
      'quick_start_import_opened',
      'taste_explorer_opened',
      'taste_lens_opened'
    ]::text[]
  )
  and jsonb_typeof(properties) = 'object'
  and octet_length(properties::text) <= 512
  and properties - array['source', 'list_size', 'count', 'format', 'outcome', 'signed_in']::text[] = '{}'::jsonb
  and (
    not properties ? 'source'
    or properties->>'source' = any (
      array[
        'empty',
        'returning',
        'search',
        'restack',
        'fullscreen_restack',
        'watch_queue',
        'hidden_queue',
        'suggestion_related',
        'suggestion_essentials',
        'suggestion_popular',
        'suggestion_unknown',
        'pack_auto',
        'pack_browse',
        'settings',
        'home',
        'pack_card',
        'discovery',
        'quick_start',
        'taste',
        'unknown'
      ]::text[]
    )
  )
  and (
    not properties ? 'list_size'
    or properties->>'list_size' = any (
      array['0', '1', '2_4', '5_9', '10_24', '25_49', '50_99', '100_plus']::text[]
    )
  )
  and (
    not properties ? 'count'
    or properties->>'count' = any (
      array['0', '1', '2_4', '5_9', '10_24', '25_49', '50_99', '100_plus']::text[]
    )
  )
  and (
    not properties ? 'format'
    or properties->>'format' = any (
      array[
        'single',
        'set',
        'svg',
        'svg_single',
        'svg_zip',
        'png',
        'png_page',
        'png_single',
        'png_zip',
        'native_single',
        'native_set',
        'markdown',
        'json',
        'text'
      ]::text[]
    )
  )
  and (
    not properties ? 'outcome'
    or properties->>'outcome' = any (
      array['completed', 'ended', 'canceled', 'failed']::text[]
    )
  )
  and (
    not properties ? 'signed_in'
    or jsonb_typeof(properties->'signed_in') = 'boolean'
  )
);
