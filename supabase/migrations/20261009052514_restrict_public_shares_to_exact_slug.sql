-- Deploy RPC-capable anonymous viewers before applying this migration.
-- Exact existing slugs remain valid; old direct-table viewers require reload.
-- No snapshot, owner, payload, slug, or revocation value is modified.
begin;

create function public.read_movie_share(share_slug text)
returns table (slug text, payload jsonb, updated_at timestamp with time zone)
language sql stable security definer
set search_path = ''
as $$
  select s.slug,
    jsonb_build_object('movies', s.payload->'movies')
      || case when s.payload ? 'displayName'
        then jsonb_build_object('displayName', s.payload->'displayName')
        else '{}'::jsonb end,
    s.updated_at
  from public.shared_lists as s
  where share_slug ~ '^[a-z0-9]{10}$'
    and s.slug = share_slug
    and s.revoked = false;
$$;

create function public.read_dog_share(share_slug text)
returns table (
  slug text, category text, payload jsonb,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
language sql stable security definer
set search_path = ''
as $$
  select s.slug, s.category,
    jsonb_build_object('items', s.payload->'items')
      || case when s.payload ? 'displayName'
        then jsonb_build_object('displayName', s.payload->'displayName')
        else '{}'::jsonb end
      || case when s.payload ? 'catalogVersion'
        then jsonb_build_object('catalogVersion', s.payload->'catalogVersion')
        else '{}'::jsonb end,
    s.created_at, s.updated_at
  from public.category_shared_lists as s
  where share_slug ~ '^[a-z0-9]{12}$'
    and s.slug = share_slug
    and s.category = 'dogs'
    and s.revoked_at is null;
$$;

-- Default PUBLIC execution is broader than the intentionally exposed API.
revoke all on function public.read_movie_share(text) from public;
revoke all on function public.read_dog_share(text) from public;
grant execute on function public.read_movie_share(text) to anon, authenticated;
grant execute on function public.read_dog_share(text) to anon, authenticated;

-- Table grants and column grants are independent: remove both. In particular,
-- category_shared_lists already grants anonymous SELECT on five columns.
revoke select on table public.shared_lists from public, anon;
revoke select (slug, payload, list_id, created_at, updated_at, revoked)
  on public.shared_lists from public, anon;
revoke select on table public.category_shared_lists from public, anon;
revoke select (slug, list_id, category, payload, created_at, updated_at, revoked_at)
  on public.category_shared_lists from public, anon;

drop policy "Anyone can read active shared lists" on public.shared_lists;
drop policy "Anyone can read active category shared lists" on public.category_shared_lists;

-- Existing authenticated owner SELECT/INSERT/UPDATE/DELETE policies and grants
-- remain intact, including an owner's ability to manage revoked snapshots.
comment on function public.read_movie_share(text) is
  'Public exact-slug access to one active Movies snapshot; never returns owner identifiers. Existing links need no login.';
comment on function public.read_dog_share(text) is
  'Public exact-slug access to one active Dogs snapshot; never returns owner identifiers or other categories. Existing links need no login.';

commit;
