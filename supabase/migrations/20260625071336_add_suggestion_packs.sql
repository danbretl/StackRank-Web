create table if not exists public.suggestion_packs (
  slug text primary key,
  title text not null,
  subtitle text not null default '',
  category text not null,
  movies jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  provenance jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  cover_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint suggestion_packs_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint suggestion_packs_version_positive check (version > 0),
  constraint suggestion_packs_movies_array check (jsonb_typeof(movies) = 'array')
);

create table if not exists public.pack_progress (
  list_id text not null,
  pack_slug text not null references public.suggestion_packs(slug) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now(),
  constraint pack_progress_pkey primary key (list_id, pack_slug),
  constraint pack_progress_state_object check (jsonb_typeof(state) = 'object')
);

create index if not exists suggestion_packs_active_sort_idx
on public.suggestion_packs (active, sort_order, slug);

create index if not exists suggestion_packs_category_idx
on public.suggestion_packs (category, sort_order, slug)
where active = true;

create index if not exists pack_progress_list_updated_idx
on public.pack_progress (list_id, updated_at desc);

alter table public.suggestion_packs enable row level security;
alter table public.pack_progress enable row level security;

grant select on table public.suggestion_packs to anon, authenticated;
grant select, insert, update, delete on table public.suggestion_packs to service_role;

grant select, insert, update, delete on table public.pack_progress to authenticated;
grant select, insert, update, delete on table public.pack_progress to service_role;

create policy "Anyone can read active suggestion packs"
on public.suggestion_packs for select
to anon, authenticated
using (active = true);

create policy "User read own pack progress"
on public.pack_progress for select
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User insert own pack progress"
on public.pack_progress for insert
to authenticated
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User update own pack progress"
on public.pack_progress for update
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text))
with check (list_id = ('user:'::text || ((select auth.uid()))::text));

create policy "User delete own pack progress"
on public.pack_progress for delete
to authenticated
using (list_id = ('user:'::text || ((select auth.uid()))::text));
