# Movies and Dogs data-safety corrections

Active execution record for the October 7 audit takeover. Start with `ASSESSMENT.md`, `checkpoint.json`, and `dispositions.json`. The final committed `HANDBACK.md` will identify the released SHA and exact CI/deployment verification. This directory does not yet assert a completed release.

- Baseline: `033a397e3ea0d7121358fe5910b7acccf4f9f566`.
- Immutable audit: `/Users/danbretl/src/stackrank-data-safety-audit-20261007T043458Z/`.
- Isolated integration checkout: `/Users/danbretl/src/stackrank-data-safety-release`, branch `fix/data-safety-20261007`.
- Authority: implement independently verified Movies/Dogs corrections through commit, push and production verification. No customer-data writes, schema/RLS expansion, credential/account changes, or external messages.
- Original checkout and unrelated untracked material remain preserved. All audit files, including snapshot and browser evidence, were hashed at takeover; see `input-preservation.json`. Its full manifest is local under ignored `reports/data-safety/` rather than embedding the archive in the repository.

## Validation boundary

The new browser suite uses fresh Chrome profiles, a loopback synthetic Supabase server, request barriers, and network denial. It exercises the actual vendored client and rendered applications. Mock revocation keeps existing access tokens valid until expiry; mocked row updates apply timestamp filters. This improves on the original audit harness. Read-only deployed schema queries separately confirmed the existing columns, grants, owner policies, RLS flags and payload constraints (`deployed-schema-readonly.json`); no production customer rows were read or written, and no real-account enforcement probe was performed.

Focused helper tests cover owner/recovery boundaries, atomic local writes, stale revisions, conditional remote writes, uncertain outcomes, database payload size, and backup fidelity. The existing staged browser suite retains broad product coverage. `npm run verify` includes the new staged data-safety suite, and CI retains its reports. Private fixtures and reports stay outside the public deployment contract.

## Compatibility boundaries

The correction uses existing table shapes and owner permissions. Conditional writes use the previously observed server token and never fall back to unconditional upserts. A clean mirror adopts account state, including intentional deletions; a dirty conflicting mirror is preserved for explicit recovery. Multiple rows are not a database transaction; partial outcomes remain possible and must be surfaced and retried or resolved without overwriting newer rows.

Old cached clients retain their previous unconditional-write behavior. The release must not claim a fleet-wide deletion guarantee, repair previously leaked/lost data, or promise that a browser-local recovery archive survives clearing browser storage. Recovery data remains bounded; unreviewed copies are not silently evicted to make room.
