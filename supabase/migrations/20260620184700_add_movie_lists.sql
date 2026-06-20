create table if not exists public.movie_lists (
  list_id text not null,
  list_type text not null,
  movies jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint movie_lists_pkey primary key (list_id, list_type),
  constraint movie_lists_list_type_check check (list_type in ('watch', 'not_interested'))
);

alter table public.movie_lists enable row level security;

grant select, insert, update, delete on table public.movie_lists to authenticated;

create policy "User read own movie lists"
on public.movie_lists for select
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User insert own movie lists"
on public.movie_lists for insert
to authenticated
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User update own movie lists"
on public.movie_lists for update
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text))
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User delete own movie lists"
on public.movie_lists for delete
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));
