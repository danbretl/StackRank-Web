-- REVIEW REQUIRED. Restores the exact pre-correction grant weakness and payload behavior.
-- Run only if explicitly approved; neither deletes nor rewrites customer rows.
begin;
drop trigger shared_lists_payload_fields on public.shared_lists;
drop function public.enforce_shared_lists_payload_fields();
grant truncate, references, trigger on table
  public.rankings, public.movie_lists, public.pack_progress,
  public.shared_lists, public.product_events, public.suggestion_packs
to anon, authenticated;

create or replace function public.enforce_product_events_session_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from (select distinct session_id from new_rows) as inserted_sessions
    where (
      select count(*)
      from public.product_events
      where session_id = inserted_sessions.session_id
    ) > 500
  ) then
    raise exception 'product event session insert limit exceeded'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_product_events_session_insert_limit() from public;


commit;
