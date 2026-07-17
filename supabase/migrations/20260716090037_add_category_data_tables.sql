-- Additive persistence for new StackRank categories. The mature Movies
-- tables and their payloads remain untouched.

create table public.category_rankings (
  list_id text not null,
  category text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint category_rankings_pkey primary key (list_id, category),
  constraint category_rankings_list_id_format check (
    list_id ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint category_rankings_category_format check (
    category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint category_rankings_category_size check (octet_length(category) <= 64),
  constraint category_rankings_items_array check (jsonb_typeof(items) = 'array'),
  constraint category_rankings_items_count check (jsonb_array_length(items) <= 5000),
  constraint category_rankings_items_size check (octet_length(items::text) <= 1048576)
);

create table public.category_lists (
  list_id text not null,
  category text not null,
  list_type text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint category_lists_pkey primary key (list_id, category, list_type),
  constraint category_lists_list_id_format check (
    list_id ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint category_lists_category_format check (
    category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint category_lists_category_size check (octet_length(category) <= 64),
  constraint category_lists_list_type_format check (
    list_type ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
  ),
  constraint category_lists_list_type_size check (octet_length(list_type) <= 64),
  constraint category_lists_items_array check (jsonb_typeof(items) = 'array'),
  constraint category_lists_items_count check (jsonb_array_length(items) <= 5000),
  constraint category_lists_items_size check (octet_length(items::text) <= 1048576)
);

create table public.category_pack_progress (
  list_id text not null,
  category text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint category_pack_progress_pkey primary key (list_id, category),
  constraint category_pack_progress_list_id_format check (
    list_id ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint category_pack_progress_category_format check (
    category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint category_pack_progress_category_size check (octet_length(category) <= 64),
  constraint category_pack_progress_state_object check (jsonb_typeof(state) = 'object'),
  constraint category_pack_progress_state_size check (octet_length(state::text) <= 8192)
);

create table public.category_shared_lists (
  slug text primary key,
  list_id text not null,
  category text not null,
  payload jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  revoked_at timestamp with time zone,
  constraint category_shared_lists_owner_category_key unique (list_id, category),
  constraint category_shared_lists_list_id_format check (
    list_id ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint category_shared_lists_slug_format check (slug ~ '^[a-z0-9]{12}$'),
  constraint category_shared_lists_category_format check (
    category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint category_shared_lists_category_size check (octet_length(category) <= 64),
  constraint category_shared_lists_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint category_shared_lists_payload_fields check (
    payload - array['displayName', 'items', 'catalogVersion']::text[] = '{}'::jsonb
  ),
  constraint category_shared_lists_payload_items_array check (
    payload ? 'items' and jsonb_typeof(payload->'items') = 'array'
  ),
  constraint category_shared_lists_payload_items_count check (
    jsonb_array_length(payload->'items') <= 2000
  ),
  constraint category_shared_lists_payload_display_name check (
    not payload ? 'displayName'
    or (
      jsonb_typeof(payload->'displayName') = 'string'
      and octet_length(payload->>'displayName') <= 160
    )
  ),
  constraint category_shared_lists_payload_catalog_version check (
    not payload ? 'catalogVersion'
    or (
      jsonb_typeof(payload->'catalogVersion') = 'string'
      and octet_length(payload->>'catalogVersion') <= 128
    )
  ),
  constraint category_shared_lists_payload_size check (
    octet_length(payload::text) <= 1048576
  )
);

alter table public.category_rankings enable row level security;
alter table public.category_lists enable row level security;
alter table public.category_pack_progress enable row level security;
alter table public.category_shared_lists enable row level security;

-- Remove any project-level default grants before adding the deliberate Data
-- API surface. Grants and RLS are separate controls and both are required.
revoke all privileges on table public.category_rankings
from public, anon, authenticated, service_role;
revoke all privileges on table public.category_lists
from public, anon, authenticated, service_role;
revoke all privileges on table public.category_pack_progress
from public, anon, authenticated, service_role;
revoke all privileges on table public.category_shared_lists
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.category_rankings
to authenticated, service_role;
grant select, insert, update, delete on table public.category_lists
to authenticated, service_role;
grant select, insert, update, delete on table public.category_pack_progress
to authenticated, service_role;
grant select, insert, update, delete on table public.category_shared_lists
to authenticated, service_role;

-- Anonymous public-list reads intentionally omit ownership and revocation
-- columns. Future public renderers must use an anonymous client, even when the
-- browser also has a signed-in owner session.
grant select (slug, category, payload, created_at, updated_at)
on table public.category_shared_lists to anon;

create policy "User read own category rankings"
on public.category_rankings for select
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User insert own category rankings"
on public.category_rankings for insert
to authenticated
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User update own category rankings"
on public.category_rankings for update
to authenticated
using (list_id = ('user:' || (select auth.uid())::text))
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User delete own category rankings"
on public.category_rankings for delete
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User read own category lists"
on public.category_lists for select
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User insert own category lists"
on public.category_lists for insert
to authenticated
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User update own category lists"
on public.category_lists for update
to authenticated
using (list_id = ('user:' || (select auth.uid())::text))
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User delete own category lists"
on public.category_lists for delete
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User read own category pack progress"
on public.category_pack_progress for select
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User insert own category pack progress"
on public.category_pack_progress for insert
to authenticated
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User update own category pack progress"
on public.category_pack_progress for update
to authenticated
using (list_id = ('user:' || (select auth.uid())::text))
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User delete own category pack progress"
on public.category_pack_progress for delete
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "Anyone can read active category shared lists"
on public.category_shared_lists for select
to anon
using (revoked_at is null);

create policy "User read own category shared lists"
on public.category_shared_lists for select
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));

create policy "User insert own category shared lists"
on public.category_shared_lists for insert
to authenticated
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User update own category shared lists"
on public.category_shared_lists for update
to authenticated
using (list_id = ('user:' || (select auth.uid())::text))
with check (list_id = ('user:' || (select auth.uid())::text));

create policy "User delete own category shared lists"
on public.category_shared_lists for delete
to authenticated
using (list_id = ('user:' || (select auth.uid())::text));
