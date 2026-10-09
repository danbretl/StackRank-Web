-- Synthetic local-only prerequisite adapter; never apply to hosted databases.
-- Audit prerequisites only. Legacy rankings columns/grants grounded in checked-in Oct7 metadata.
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
CREATE TABLE public.rankings(list_id text PRIMARY KEY,movies jsonb NOT NULL DEFAULT '[]',updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.rankings TO anon,authenticated;
GRANT ALL ON public.rankings TO service_role;
-- Scheduler compatibility adapter: creates no job; retention/trigger function itself remains exact migration SQL.
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT -1::bigint $$;
-- Minimal storage API prerequisite schema. This does not simulate Storage HTTP authorization.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,bucket_id text REFERENCES storage.buckets(id),name text,owner uuid,metadata jsonb);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;

CREATE ROLE authenticator LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA security_test;
CREATE FUNCTION security_test.check(label text, expected text, statement text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE actual text;
BEGIN
  BEGIN EXECUTE statement INTO actual;
  EXCEPTION WHEN OTHERS THEN actual := 'error:' || SQLSTATE; END;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL % expected % got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'PASS|%', label;
END $$;
GRANT USAGE ON SCHEMA security_test TO anon, authenticated, authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security_test TO anon, authenticated, authenticator;
