# Dogs additive Supabase/RLS review

Status: **prepared locally, read-only production compatibility-audited on July 16, and successfully
rehearsed on a disposable hosted Postgres 17 branch on July 21, 2026; not applied to production.**

The proposed migration is
`supabase/migrations/20260716090037_add_category_data_tables.sql`. It was created with
`supabase migration new add_category_data_tables` using Supabase CLI 2.109.1. It adds only generic
new-category tables; it does not alter the mature Movies tables or payloads.

The separate proposed migration
`supabase/migrations/20260716090038_add_dog_artwork_storage.sql` prepares immutable Dogs artwork
delivery. It creates the public `dogs-catalog` bucket with a 5 MiB object limit and a WebP-only MIME
allowlist. Supabase public buckets serve known direct object URLs without a `storage.objects`
SELECT policy, so the migration creates no browser policy for listing, INSERT, UPDATE, or DELETE.
An accountable operator must upload through the service role and verify the delivered bytes. It
does not upload any object.

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

The local Supabase stack remains unavailable because no Docker-compatible runtime or local Postgres
is installed. After the unchanged Stack Rank project moved to the Pro organization, a disposable
Micro branch was created for the hosted rehearsal at the confirmed $0.01344/hour rate. It contained
no production data, passed the automated probe set below, and was deleted without merge immediately
afterward. Supabase CLI 2.109.1 was used for the rehearsal.

Read-only inspection of the linked production project confirmed:

- PostgreSQL 17.6 and `auth.uid()` are available;
- all four proposed `category_*` relation names are unused;
- the proposed `dogs-catalog` storage bucket id is unused and no existing storage policy references it;
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

The ledger comparison also found one earlier pending migration:
`20260709001734_add_tonight_events.sql`. A normal `supabase db push` would apply that Movies
telemetry allowlist migration before the two Dogs migrations. Rehearse and authorize it separately;
do not describe a three-file push as Dogs-only. The CLI's passwordless temporary login role also
failed read-only `migration list --linked` and `db push --linked --dry-run` checks for this project.
Use the documented password-based fallback by setting `SUPABASE_DB_PASSWORD` privately in the
operator shell before a future authorized dry run or push. Never paste that password into chat or
commit it.

The repository's tracked migration sequence is not a clean-database baseline: its first policy
optimization assumes the pre-existing `public.rankings` table. Therefore, do not use a fresh
repository-wide `supabase db reset` as the first Dogs rehearsal. Use a disposable scratch Supabase
workdir containing only the two additive Dogs migrations. Supabase's local base provides the
required `auth.uid()` and `storage.buckets` surfaces while the scratch history avoids altering or
inventing legacy Movies migration records.

## Disposable hosted branch rehearsal harness (preferred)

`scripts/rehearse-dogs-supabase-branch.mjs` automates the evidence pass against a disposable hosted
branch created from the production schema and migration history. It never creates a branch or
applies a migration. It fails closed unless the operator supplies the exact disposable branch ref,
the branch URL and credentials, the branch Postgres URL, and a deliberate confirmation phrase. The
production ref `hrfhakrxsllrqmscxxpb` is rejected at the expected-ref, API-origin, and database
identity boundaries.

Create a no-production-data branch, establish the repository's known mature schema baseline, apply
the following three pending migrations in order, and do not Git-integrate or merge the branch:

1. `20260709001734_add_tonight_events.sql`
2. `20260716090037_add_category_data_tables.sql`
3. `20260716090038_add_dog_artwork_storage.sql`

Set credentials only in the operator's private shell. Do not paste them into chat, a note, a shell
history file, or a commit. Modern branch publishable/secret keys and legacy anon/service-role keys
both work because the harness passes the supplied values only to the matching branch endpoints.

```sh
export STACKRANK_SUPABASE_EXPECTED_BRANCH_REF='<20-character-disposable-branch-ref>'
export STACKRANK_SUPABASE_BRANCH_URL="https://${STACKRANK_SUPABASE_EXPECTED_BRANCH_REF}.supabase.co"
export STACKRANK_SUPABASE_BRANCH_PUBLISHABLE_KEY='<branch-publishable-key>'
export STACKRANK_SUPABASE_BRANCH_SECRET_KEY='<branch-secret-key>'
export STACKRANK_SUPABASE_BRANCH_DB_URL='<branch-postgres-connection-url>'
export STACKRANK_SUPABASE_REHEARSAL_CONFIRM='I_UNDERSTAND_THIS_TARGETS_ONLY_A_DISPOSABLE_BRANCH'
node scripts/rehearse-dogs-supabase-branch.mjs
```

The harness verifies the exact three migration-ledger entries, all four tables, grants, RLS policy
surface, constraint names, and bounded public WebP bucket through the Postgres connection. It then
creates two confirmed disposable Auth users and exercises real JWT-backed Data API behavior: User A
owner CRUD, User B isolation and cross-owner denial, distinct Dogs/Books rows, anonymous safe-column
snapshot reads, ownership/revocation-column denial, and revoked-snapshot hiding. Finally it uploads
a uniquely named service-role WebP fixture, verifies known-object public bytes/content type/one-year
cache policy, and proves anonymous/authenticated clients cannot discover, insert, overwrite, or
delete it. Security and performance advisors run as separate CLI passes.

Fixture rows, objects, and Auth users are removed in `finally`, with service-role cleanup as a
fallback even when a probe fails. The harness prints phases and advisor results but redacts the
supplied keys, full database URL, and database password. A cleanup failure makes the rehearsal fail;
resolve it in the disposable branch before deletion. After a passing run, save the non-secret
terminal output as evidence, then delete the disposable branch without merge.

### July 21 hosted rehearsal result

The CLI-created no-data branch initially reported `MIGRATIONS_FAILED` because Supabase replayed the
repository from its first tracked migration, while that history intentionally begins after the
pre-existing `rankings` table. The branch contained only `movie_lists` and the first migration ledger
row; a naïve `db push` would therefore have attempted already-applied history against an incomplete
baseline. No production system was involved and no such push was made.

On the disposable branch only, the minimal mature `rankings` baseline was restored, the tracked
historical migrations were replayed to construct the repository schema, and the three pending files
were applied in their real order. The session-mode IPv4 pooler was used because the direct database
host required unavailable IPv6 and the transaction pooler rejected prepared statements. The
rehearsal harness then passed every stage:

- exact pending migration ledger entries, four category tables, grants, RLS, 17 policies, payload
  constraints, and the bounded public WebP bucket;
- two real disposable Auth users covering owner CRUD, cross-owner denial, User A/User B isolation,
  and separate Dogs/Books rows under the same owner;
- anonymous safe-column public snapshot reads, ownership-column denial, owner revocation, and
  anonymous post-revocation denial;
- service-only fixture upload, known-object public WebP GET with exact bytes/MIME/year cache,
  anonymous/authenticated list and write denial, and denied overwrite/delete behavior;
- deterministic cleanup of all rows, the Storage fixture, and both Auth users.

Security advisors returned no findings. Performance advisors returned only the pre-existing Movies
`shared_lists` overlapping permissive SELECT-policy warning already recorded in the production
baseline. The branch `fxgypetljxgsxsiegwpe` was deleted without merge; a follow-up branch listing
showed only the production `main` branch. This closes the real-Postgres/RLS/Data API/Storage rehearsal
gate but does not authorize or claim production migration application.

## Direct local probes to run when a container runtime is available

Discover command flags again after any CLI upgrade. From the repository root, create an isolated
workdir and copy only the two migrations under review:

```sh
ROOT="$PWD"
TMPBASE="${TMPDIR:-/tmp}"
TMPBASE="${TMPBASE%/}"
SCRATCH="$(mktemp -d "$TMPBASE/stackrank-dogs-supabase.XXXXXX")"
cd "$SCRATCH"
supabase init
cp "$ROOT/supabase/migrations/20260716090037_add_category_data_tables.sql" \
  "$SCRATCH/supabase/migrations/"
cp "$ROOT/supabase/migrations/20260716090038_add_dog_artwork_storage.sql" \
  "$SCRATCH/supabase/migrations/"
supabase start
supabase db reset --local --no-seed
supabase migration list --local
supabase db lint --local --schema public --level error --fail-on error
supabase db advisors --local --type all --level info --fail-on error
```

Keep the scratch database running through the SQL, Data API, and Storage probes below. When all
evidence is captured, stop and delete only this disposable instance:

```sh
cd "$SCRATCH"
supabase stop --no-backup
cd "$ROOT"
case "$SCRATCH" in
  "$TMPBASE"/stackrank-dogs-supabase.*) rm -rf "$SCRATCH" ;;
  *) echo "Refusing to remove unexpected scratch path: $SCRATCH" >&2; exit 1 ;;
esac
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

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'dogs-catalog';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    policyname ilike '%Dogs%'
    or coalesce(qual, '') ilike '%dogs-catalog%'
    or coalesce(with_check, '') ilike '%dogs-catalog%'
  )
order by policyname;
"
```

Use two disposable UUIDs to probe ownership and category isolation inside transactions. Expected
permission failures should be run as separate `supabase db query --local` calls because a failed
statement aborts its transaction. Keep the User A rows alive in the same transaction while probing
User B; rolling User A back before User B's query would make an expected zero result meaningless.

```sql
-- User A can create distinct Dogs and Books rows with the same list id,
-- while User B sees neither row in the same transaction.
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
reset role;
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

Before any production application, complete the scratch rehearsal with Data API REST behavior under
real local User A, User B, and anonymous JWT contexts, then run security and performance advisors.
The disposable hosted branch is preferred now that the project belongs to Pro, but it is not a
substitute for explicit production authorization.

For the production path, first rehearse `20260709001734_add_tonight_events.sql` separately against a
disposable copy of the current `product_events` schema. Then set `SUPABASE_DB_PASSWORD` privately
and run `supabase db push --linked --dry-run`; it must report exactly the Tonight migration followed
by the two Dogs migrations. Apply that ordered three-file set only if Dan explicitly authorizes all
three. Afterward, repeat the schema/grant/policy/constraint checks, Data API probes, and advisors
before enabling Dogs sync or public links.

For artwork storage, also verify that an anonymous GET of one operator-uploaded fixture succeeds,
that anonymous/authenticated list, INSERT, UPDATE, and DELETE attempts fail, and that the returned
bytes, content type, and one-year cache header match the delivery manifest. Delete the disposable
fixture with the service role before treating the storage rehearsal as complete.
