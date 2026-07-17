# Dogs additive Supabase/RLS review

Status: **prepared locally and read-only production compatibility-audited on July 16, 2026; not
applied to any database.**

The proposed migration is
`supabase/migrations/20260716090037_add_category_data_tables.sql`. It was created with
`supabase migration new add_category_data_tables` using Supabase CLI 2.109.1. It adds only generic
new-category tables; it does not alter the mature Movies tables or payloads.

## Current platform guidance reviewed

- [Supabase changelog index](https://supabase.com/changelog.md), fetched July 16, 2026.
- [April 28, 2026 Data API exposure breaking change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): new public tables increasingly require explicit grants; grants and RLS are separate controls.
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api): grant only the minimum role privileges and enable RLS on every exposed table.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): use `TO` roles, wrap `auth.uid()` in `select`, give UPDATE both `USING` and `WITH CHECK`, and provide the corresponding SELECT policy.

No changelog breaking change affecting ordinary Postgres RLS policy syntax was found. The relevant
change is the explicit Data API grant requirement, which the migration handles per table.

## Proposed schema

| Table | Primary identity | Client payload bound | Public access |
| --- | --- | --- | --- |
| `category_rankings` | `(list_id, category)` | `items`: array, ≤5,000 entries, ≤1 MiB | None |
| `category_lists` | `(list_id, category, list_type)` | `items`: array, ≤5,000 entries, ≤1 MiB | None |
| `category_pack_progress` | `(list_id, category)` | `state`: object, ≤8 KiB | None |
| `category_shared_lists` | `slug`; unique `(list_id, category)` | allowlisted snapshot object, ≤2,000 entries, ≤1 MiB | Anonymous, non-revoked snapshots only |

Every owner table:

- constrains `list_id` to `user:<uuid>` and category/list-type identifiers to 64-byte slug formats;
- enables RLS explicitly;
- revokes inherited/default access before granting a deliberate Data API surface;
- grants signed-in clients SELECT/INSERT/UPDATE/DELETE and creates one ownership policy for each;
- uses `list_id = ('user:' || (select auth.uid())::text)`;
- gives UPDATE both `USING` and `WITH CHECK`;
- has a SELECT policy so UPDATE is functional;
- grants the service role explicitly without exposing a service credential in browser code.

Composite keys keep one user's categories and list types in distinct rows. The DOM-free client
helpers additionally reject remote rows whose category, list type, owner id, or entity domains do
not match the active adapter.

## Public snapshot boundary

Anonymous access is intentionally narrower than owner access:

- `anon` receives SELECT only on `slug`, `category`, `payload`, `created_at`, and `updated_at`;
- `list_id` and `revoked_at` are not selectable anonymously;
- the anonymous SELECT policy requires `revoked_at is null`;
- `authenticated` has only the owner SELECT policy, including for revoked rows.

A future `/s/:category/:slug` renderer must therefore create a deliberately anonymous Supabase
client with session persistence disabled, even if the browser also has a signed-in StackRank
session. This prevents the public policy from making another owner's `list_id` visible to an
authenticated reader. Owner management continues through the signed-in client.

The client snapshot builder permits only `{ displayName, items, catalogVersion }`. Each item is
reduced to the category-neutral `{ entityRef, snapshot }` contract. Artwork still needs the
independent provider-purpose gate before its URL or asset id is included.

## Verification completed without applying schema

- Static migration tests assert all four tables, RLS enablement, explicit grants, all four owner
  operations, UPDATE `USING` plus `WITH CHECK`, public non-revoked reads, payload bounds, and no
  alteration of `rankings`, `movie_lists`, `pack_progress`, or `shared_lists`.
- Unit tests cover row construction, UTF-8 payload bounds, category/owner/list isolation, canonical
  entity validation, newest-base no-loss ranking merges, older-only pack recovery, public snapshot
  reduction, and malformed/cross-category rejection.

The local Supabase stack was unavailable because Docker and local Postgres are not installed. A
disposable Supabase branch was then cost-confirmed at $0.01344/hour, but Supabase rejected creation
because branch management requires Pro and this organization is on Free. No branch was created and
no branch charge began.

Read-only inspection of the linked production project confirmed:

- PostgreSQL 17.6 and `auth.uid()` are available;
- all four proposed `category_*` relation names are unused;
- all four mature Movies relations remain present;
- the current migration ledger ends at `20260708160447_allow_owner_read_shared_lists`, so the local
  `20260716090037` version does not collide;
- the `anon`, `authenticated`, and `service_role` roles are present;
- the exact category/list-type regex, new 64-byte bound, JSON allowlist subtraction, optional-field
  predicate, JSON array check, and JSON byte-size expressions evaluate as intended.

Production security advisors reported three pre-existing warnings unrelated to the unapplied
category migration: anonymous and authenticated callers can directly execute
`public.enforce_product_events_session_insert_limit()`, and leaked-password protection is disabled.
Performance advisors reported two unused Movies indexes and overlapping permissive SELECT policies
on `shared_lists`. These are baseline observations, not category-schema results; this review did not
change them or any other production state. No full DDL parse, RLS behavior probe, Data API request,
or advisor-after-migration result is claimed.

## Direct local probes to run when Docker is available

Discover command flags again after any CLI upgrade, then run:

```sh
supabase start
supabase db reset --local --no-seed
supabase migration list --local
supabase db lint --local --schema public --level error --fail-on error
supabase db advisors --local --type all --level info --fail-on error
```

Inspect the schema, grants, policies, and bounds:

```sh
supabase db query --local "
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('category_rankings','category_lists','category_pack_progress','category_shared_lists')
order by c.relname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'category_%'
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like 'category_%'
order by tablename, policyname;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'public.category_rankings'::regclass,
  'public.category_lists'::regclass,
  'public.category_pack_progress'::regclass,
  'public.category_shared_lists'::regclass
)
order by table_name::text, conname;
"
```

Use two disposable UUIDs to probe ownership and category isolation inside transactions. Expected
permission failures should be run as separate `supabase db query --local` calls because a failed
statement aborts its transaction.

```sql
-- User A can create distinct Dogs and Books rows with the same list id.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
insert into public.category_rankings (list_id, category, items)
values
  ('user:11111111-1111-4111-8111-111111111111', 'dogs', '[]'),
  ('user:11111111-1111-4111-8111-111111111111', 'books', '[]');
select category from public.category_rankings order by category;
rollback;
```

```sql
-- User B must see zero rows owned by User A.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select count(*) as expected_zero
from public.category_rankings
where list_id = 'user:11111111-1111-4111-8111-111111111111';
rollback;
```

```sql
-- This insert must fail its WITH CHECK policy for User B.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
insert into public.category_lists (list_id, category, list_type, items)
values ('user:11111111-1111-4111-8111-111111111111', 'dogs', 'curious', '[]');
rollback;
```

For public snapshots, insert an active row as its authenticated owner, then switch to `anon` and
verify the safe columns are readable. A direct `SELECT list_id` must fail with column permission
denied. After the owner sets `revoked_at`, the anonymous safe-column query must return zero rows.

Before any production application, repeat the behavior probes against a disposable Supabase branch,
run security and performance advisors there, and inspect Data API REST behavior with real User A,
User B, and anonymous JWT contexts. Production migration application remains a separate explicit
authorization gate.
