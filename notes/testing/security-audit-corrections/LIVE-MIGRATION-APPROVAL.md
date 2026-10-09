# Exact live database action awaiting confirmation

Target: Supabase project `hrfhakrxsllrqmscxxpb`, production, public schema.
These two migrations are prepared and tested locally, not applied live.
Run them in filename order only after the new anonymous RPC-capable viewers are
verified on production and Dan/parent confirms these exact actions.

1. Revoke TRUNCATE/TRIGGER/REFERENCES from anon/authenticated on six legacy
   Movies/support tables; preserve normal DML and owner RLS. Replace telemetry
   statement trigger function with a 20-row burst guard while keeping 500/session.
   Add a trigger rejecting unsupported Movies payload keys on inserts/payload writes.
2. Add two exact-slug public read functions; project public fields only. Remove
   anonymous share-table and column SELECT grants and the two public-read policies.
   Authenticated owners retain their management policies; public visitors use RPCs.

No customer rows, IDs, slugs, payloads, rankings, backups or credentials are changed.
No Auth settings or default privileges are changed. Existing URLs and anonymous
viewing remain; already-loaded cached viewers need reload after the access cutover.
Publicly obtained links/copies cannot be retracted by this change. Rate limits remain
partial: telemetry repeated small statements and distributed proxy traffic remain possible.

Risk: a client/server rollout mismatch can temporarily make a shared link unavailable;
new clients use a missing-RPC-only fallback before migration. Transactional SQL avoids
partial changes within each migration. Short DDL locks may delay writes while applied.
A failed migration rolls back its own changes; inspect before retrying.

Rollback SQL is committed beside this note: `rollback-database-hardening.sql` and
`share-rollback.sql`. Both passed 24 local rollback assertions. Rollback restores
prior weaknesses and requires separate explicit approval; prefer a forward fix.
Keep RPC-capable clients after cutover; do not deploy an old direct-table viewer alone.

Local verification: 212 native PostgreSQL assertions, synthetic records only; both
migrations and rollback tested. Read-only hosted ACL/function metadata confirms target
objects and absent RPC name collisions. PostgREST/JWT behavior is not certified by
local SQL; after approval verify hosted metadata and only invalid-slug/zero-row API
requests, never customer records or production attacks.

## Exact artifacts

- `supabase/migrations/20261009052409_harden_legacy_privileges_and_payload_writes.sql` — SHA-256 `ea07a9f75f188826fbae4ef18a8168d1a3ac52d713837f51d4f65b7265d3efe7`
- `supabase/migrations/20261009052514_restrict_public_shares_to_exact_slug.sql` — SHA-256 `a096c9a23952eed5d1398be08f6d3ddf655e31762a20d4d60a65b56ea67bb7d7`

## Exact SQL

### 20261009052409_harden_legacy_privileges_and_payload_writes.sql

```sql
begin;

-- SR-02: these maintenance/DDL privileges are not used by any browser API.
-- Preserve existing SELECT/INSERT/UPDATE/DELETE grants and all owner RLS policies.
revoke truncate, references, trigger on table
  public.rankings, public.movie_lists, public.pack_progress,
  public.shared_lists, public.product_events, public.suggestion_packs
from anon, authenticated;

-- SR-03: bound a single statement, including one rotating client session IDs.
-- This is not a request-rate limit: repeated smaller requests remain possible.
create or replace function public.enforce_product_events_session_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from new_rows) > 20 then
    raise exception 'product event statement insert limit exceeded'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from (select distinct session_id from new_rows) as inserted_sessions
    where (
      select count(*) from public.product_events
      where session_id = inserted_sessions.session_id
    ) > 500
  ) then
    raise exception 'product event session insert limit exceeded'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function public.enforce_product_events_session_insert_limit()
from public, anon, authenticated;

-- SR-08: enforce the existing browser payload contract on new payload writes.
-- Unlike a NOT VALID CHECK, this allows revocation of untouched legacy payloads
-- without scanning, rewriting, or disclosing any existing customer rows.
create function public.enforce_shared_lists_payload_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.payload - array['displayName', 'movies']::text[] <> '{}'::jsonb then
    raise exception 'shared list payload contains unsupported fields'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_shared_lists_payload_fields()
from public, anon, authenticated;

create trigger shared_lists_payload_fields
before insert or update of payload on public.shared_lists
for each row execute function public.enforce_shared_lists_payload_fields();

commit;
```

### 20261009052514_restrict_public_shares_to_exact_slug.sql

```sql
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
```
