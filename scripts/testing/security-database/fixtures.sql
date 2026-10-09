-- Synthetic rows inserted by the bootstrap superuser after migrations (table owner; not an RLS test).
-- ownerA = aaaaaaaa-1111-4111-8111-111111111111, ownerB = bbbbbbbb-2222-4222-8222-222222222222
\set ON_ERROR_STOP on
begin;
insert into public.rankings (list_id, movies) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', '[{"title":"Aye Private One","tmdbId":900301}]'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', '[{"title":"Bee Private One","tmdbId":900201}]');
insert into public.movie_lists (list_id, list_type, movies) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', 'watch', '[]'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', 'watch', '[{"title":"Bee Watch","tmdbId":900202}]');
insert into public.suggestion_packs (slug, title, category, movies, active) values
  ('audit-active', 'Audit Active', 'audit', '[]', true),
  ('audit-inactive-hidden', 'Audit Inactive', 'audit', '[]', false);
insert into public.pack_progress (list_id, pack_slug, state) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', 'audit-active', '{}'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', 'audit-active', '{"seen":1}');
insert into public.shared_lists (slug, payload, list_id, revoked) values
  ('aaaaaaaaa1', '{"displayName":"Aye","movies":[{"title":"Aye Shared","tmdbId":900301}]}', 'user:aaaaaaaa-1111-4111-8111-111111111111', false),
  ('aaaaaaaaa2', '{"displayName":"Aye","movies":[{"title":"Aye Revoked","tmdbId":900302}]}', 'user:aaaaaaaa-1111-4111-8111-111111111111', true),
  ('bbbbbbbbb1', '{"displayName":"Bee","movies":[{"title":"Bee Shared","tmdbId":900201}]}', 'user:bbbbbbbb-2222-4222-8222-222222222222', false);
insert into public.category_rankings (list_id, category, items) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', 'dogs', '[]'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', 'dogs', '[{"entityRef":{"domain":"dogs","type":"breed","source":"vbo","id":"0000001"},"snapshot":{"primaryText":"Bee Dog"}}]');
insert into public.category_lists (list_id, category, list_type, items) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', 'dogs', 'curious', '[]'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', 'dogs', 'curious', '[]');
insert into public.category_pack_progress (list_id, category, state) values
  ('user:aaaaaaaa-1111-4111-8111-111111111111', 'dogs', '{}'),
  ('user:bbbbbbbb-2222-4222-8222-222222222222', 'dogs', '{}');
insert into public.category_shared_lists (slug, list_id, category, payload, revoked_at) values
  ('aaaaaaaaaaa1', 'user:aaaaaaaa-1111-4111-8111-111111111111', 'dogs', '{"displayName":"Aye","items":[]}', null),
  ('aaaaaaaaaaa2', 'user:aaaaaaaa-1111-4111-8111-111111111111', 'books', '{"items":[]}', now()),
  ('bbbbbbbbbbb1', 'user:bbbbbbbb-2222-4222-8222-222222222222', 'dogs', '{"items":[]}', null);
commit;

INSERT INTO public.shared_lists(slug,list_id,payload) VALUES
('legacy0001','user:aaaaaaaa-1111-4111-8111-111111111111','{"movies":[],"legacyExtra":"synthetic only"}');
