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
