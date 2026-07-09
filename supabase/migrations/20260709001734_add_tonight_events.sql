-- "Pick something for tonight" telemetry: two new event names
-- (tonight_opened, tonight_picked) and three new bounded source values
-- ('tonight' for ranking_started ingress, 'tonight_mood' / 'tonight_no_mood'
-- for whether a vibe was applied when a pick was ranked). No new property
-- keys, no identifiers — the mood text itself is never recorded.

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
      'taste_lens_opened',
      'tonight_opened',
      'tonight_picked'
    ]::text[]
  )
);

alter table public.product_events
drop constraint product_events_property_values_allowlist,
add constraint product_events_property_values_allowlist check (
  (
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
        'tonight',
        'tonight_mood',
        'tonight_no_mood',
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
      'taste_lens_opened',
      'tonight_opened',
      'tonight_picked'
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
        'tonight',
        'tonight_mood',
        'tonight_no_mood',
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
