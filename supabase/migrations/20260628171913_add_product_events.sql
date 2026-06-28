create table public.product_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  session_id uuid not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamp with time zone not null default now(),
  constraint product_events_known_name check (
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
        'import_opened',
        'import_completed'
      ]::text[]
    )
  ),
  constraint product_events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint product_events_properties_bounded check (octet_length(properties::text) <= 512),
  constraint product_events_properties_allowlist check (
    properties - array['source', 'list_size', 'count', 'format', 'outcome', 'signed_in']::text[] = '{}'::jsonb
  )
);

create index product_events_name_time_idx
on public.product_events (event_name, occurred_at desc);

create index product_events_session_time_idx
on public.product_events (session_id, occurred_at);

alter table public.product_events enable row level security;

revoke select, update, delete on table public.product_events from anon, authenticated;
grant insert on table public.product_events to anon, authenticated;
grant usage on sequence public.product_events_id_seq to anon, authenticated;

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
      'import_opened',
      'import_completed'
    ]::text[]
  )
  and jsonb_typeof(properties) = 'object'
  and octet_length(properties::text) <= 512
  and properties - array['source', 'list_size', 'count', 'format', 'outcome', 'signed_in']::text[] = '{}'::jsonb
);
