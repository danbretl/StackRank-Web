drop policy if exists "User update own list" on public.rankings;

create policy "User update own list"
on public.rankings for update
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text))
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create index if not exists pack_progress_pack_slug_idx
on public.pack_progress (pack_slug);
