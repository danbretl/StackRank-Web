drop policy if exists "User read own shared lists" on public.shared_lists;

create policy "User read own shared lists"
on public.shared_lists for select
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));
