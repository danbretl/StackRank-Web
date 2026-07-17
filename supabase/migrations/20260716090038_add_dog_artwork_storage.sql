-- Public, immutable delivery surface for rights-approved StackRank Dogs
-- artwork. This does not upload any objects and grants no browser writes or
-- object-listing access.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dogs-catalog',
  'dogs-catalog',
  true,
  5242880,
  array['image/webp']::text[]
);

-- Supabase public buckets serve direct object URLs without a storage.objects
-- SELECT policy. Deliberately create no SELECT, INSERT, UPDATE, or DELETE
-- policy for anon/authenticated: browser clients may fetch a known public URL
-- but cannot list or mutate objects. Operator uploads use the service role,
-- which is never exposed to browser code and bypasses RLS deliberately.
