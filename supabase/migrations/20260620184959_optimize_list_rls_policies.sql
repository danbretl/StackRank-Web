drop policy if exists "User read own list" on public.rankings;
drop policy if exists "User insert own list" on public.rankings;
drop policy if exists "User update own list" on public.rankings;

create policy "User read own list"
on public.rankings for select
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User insert own list"
on public.rankings for insert
to authenticated
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User update own list"
on public.rankings for update
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));

drop policy if exists "User read own movie lists" on public.movie_lists;
drop policy if exists "User insert own movie lists" on public.movie_lists;
drop policy if exists "User update own movie lists" on public.movie_lists;
drop policy if exists "User delete own movie lists" on public.movie_lists;

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
