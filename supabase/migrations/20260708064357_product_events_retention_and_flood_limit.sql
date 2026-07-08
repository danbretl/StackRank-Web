create extension if not exists pg_cron with schema pg_catalog;

create index if not exists product_events_occurred_at_idx
on public.product_events (occurred_at);

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

drop trigger if exists product_events_session_insert_limit on public.product_events;

create trigger product_events_session_insert_limit
after insert on public.product_events
referencing new table as new_rows
for each statement
execute function public.enforce_product_events_session_insert_limit();

select cron.schedule(
  'stackrank-product-events-retention',
  '17 9 * * *',
  $$ delete from public.product_events where occurred_at < now() - interval '180 days' $$
);
