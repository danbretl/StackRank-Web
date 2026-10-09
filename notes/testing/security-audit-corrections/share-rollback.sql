-- EMERGENCY COMPATIBILITY ROLLBACK; NOT PART OF THE FORWARD MIGRATION.
-- This deliberately reopens SR-01 owner-identifier exposure and SR-04 public
-- enumeration to restore the documented baseline direct-table reader behavior.
-- Never execute in production without separate approval of this exact SQL.
-- Prefer retaining an RPC-capable viewer or rolling forward instead.
-- Synthetic native regression tests may exercise this on disposable fixtures.
begin;

grant select on table public.shared_lists to anon;
grant select (slug, category, payload, created_at, updated_at)
  on public.category_shared_lists to anon;

create policy "Anyone can read active shared lists"
  on public.shared_lists for select to anon, authenticated
  using (revoked = false);
create policy "Anyone can read active category shared lists"
  on public.category_shared_lists for select to anon
  using (revoked_at is null);

-- Keep the RPCs so the new viewers also continue to work. No rows or owner
-- policies are changed, and no functions or customer snapshots are deleted.
commit;
