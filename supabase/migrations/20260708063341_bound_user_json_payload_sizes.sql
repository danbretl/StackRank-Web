do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rankings_movies_payload_size'
      and conrelid = 'public.rankings'::regclass
  ) then
    alter table public.rankings
      add constraint rankings_movies_payload_size
      check (octet_length(movies::text) <= 1048576)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'movie_lists_movies_payload_size'
      and conrelid = 'public.movie_lists'::regclass
  ) then
    alter table public.movie_lists
      add constraint movie_lists_movies_payload_size
      check (octet_length(movies::text) <= 1048576)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pack_progress_state_payload_size'
      and conrelid = 'public.pack_progress'::regclass
  ) then
    alter table public.pack_progress
      add constraint pack_progress_state_payload_size
      check (octet_length(state::text) <= 8192)
      not valid;
  end if;
end $$;

alter table public.rankings
  validate constraint rankings_movies_payload_size;

alter table public.movie_lists
  validate constraint movie_lists_movies_payload_size;

alter table public.pack_progress
  validate constraint pack_progress_state_payload_size;
