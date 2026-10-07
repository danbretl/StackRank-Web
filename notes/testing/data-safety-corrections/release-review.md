# Independent release-readiness review

Reviewer: Astra release reviewer, October 7, 2026. Baseline `033a397e3ea0d7121358fe5910b7acccf4f9f566`; integration `fix/data-safety-20261007`. This review complements the architecture lead's CAS, ownership and application-race review. No runtime source was edited by this reviewer.

## Material findings and dispositions

1. **Recovery capacity could become inaccessible.** The shared eight-entry limit includes resolved copies, but both applications originally requested only unresolved entries. Dogs additionally lacked a dismissal action. Both UIs now request `includeResolved: true` and label previously added/reviewed copies; Dogs now has explicit confirmed dismissal, and Movies retains its confirmed dismissal. No automatic eviction was added. Source re-review accepts these corrections; the browser owner is adding capacity and dismissal regressions.
2. **Temporary recovery could be presented as durable.** Both UIs originally ignored `memoryOnly` from failed owner-departure persistence. They now label session-only copies, retain download controls and warn against reload/close. Dogs retains a generic departure warning across later account transitions without exposing the prior owner's identity or contents. Movies now also uses a separate tab-lifetime departure warning that remains visible across later owner changes and routine status updates; source re-review accepts it. A recovered copy in RAM remains inherently vulnerable to browser/tab termination; the release must not claim that it survived a failed storage write.
3. **New download filenames broke public-file classification.** The first isolated deployment build rejected the Movies fixed recovery filename and Dogs interpolated recovery filename. The owner added narrow non-file/acknowledged-construction entries, consistent with existing download handling. The subsequent build passes with 2,171 public files, 1,137 excluded paths and zero unclassified paths. No dummy download artifact was published.

## Other examined boundaries

- Home progress reads only the safety document's matching unexpired-session owner, or genuine anonymous owner. It never falls back to legacy unowned bytes or another account's mirror; invalid data yields zero. It remains an informational local count, not proof of remote authentication or synchronization.
- Privacy now distinguishes device persistence from confirmed account sync, explains explicit ownership/recovery decisions, retention after sign-out, browser-storage deletion, and the remaining risk from older cached clients. It does not promise fleet-wide deletion protection or automatic repair of prior loss/leakage.
- Shared recovery limits fail closed without silently evicting copies. Confirmed dismissal is deliberate data removal; source fingerprints prevent unchanged legacy bytes from being automatically re-imported after dismissal. Original legacy keys remain untouched.
- Four added browser modules (`lib/data-safety.js`, `lib/home-progress.js`, `lib/json-size.js`, `lib/movies-data-safety.js`) were individually byte-compared against the isolated public build and matched. New test harness/fixture paths and review notes were checked absent. Vercel still targets `dist/public`; the CI change retains data-safety test reports as artifacts rather than public files.
- The new browser harness uses actual application files and the vendored client with a synthetic loopback service. Source inspection confirms CDP network allowlisting in addition to fetch interception, including protection against direct-IP external requests. This is not a deployed RLS/real-account test.

## Checks actually run

`node --test tests/home-progress.test.js tests/data-safety.test.js`: **27 passed**, zero failures, on the reviewed evolving candidate. Isolated `node deploy/build.mjs --build-dir reports/data-safety/release-review-build`: passed after the filename declarations; four new module byte matches and explicit tooling/evidence exclusions passed. These are scoped review checks, not substitutes for the final full verification or frozen-source deployment receipt. Logs: `/tmp/data-safety-release-review-unit.log`, `/tmp/data-safety-release-review-build.log`.

## Release gate and never-run limits

This reviewer has not run the complete final browser suite, final `npm run verify`, exact-commit CI, production deployment, real customer-account writes, production CAS/RLS probes or migration tests. Root owns final freeze, complete verification and release. The browser worker must finish the session-warning and capacity regressions, then root must validate cache versions and the final deployment closure after all edits. The immediate Movies local-flush change was source-reviewed: local persistence now starts outside the network queue. The architecture lead accepted the adjacent current-snapshot durability issue (IR-016). The Movies owner now awaits a fresh local flush before each remote surface, then rechecks owner/block status before capturing its baseline and request payload. Immediate local persistence still starts outside the network queue. Source re-review accepts both gates; the browser worker owns the blocked-request/Web-Lock regression. No release-success claim is made here.

## Final source recommendation

No remaining blocking finding in this reviewer's scoped source review. Proceed to root's final full verification and exact-commit release gates; this is not a waiver for browser failures or CI/production checks. All four reported issues (capacity access, session-only truthfulness, deployment filename classification, and current-snapshot durability) have concrete source corrections. Documentation-only replacement passages were delivered at `/tmp/data-safety-doc-followthrough.md`; tracked project guidance was deliberately left unchanged for root's post-product receipt commit.

Reviewed source SHA-256 at 2026-10-07T06:07:23.367675+00:00:

- `app.js`: `754e27b312aa4463af090a0a93e7dad8f6229bac2b1d2313b9e8e7750d3765ec`
- `dogs.js`: `30f336b761f8905963505f52b476aae39064785fe1bd1387abbef3a1f0f0b744`
- `home.js`: `a6a1caa9769b196e6cc7801ab376c2b6db4731216f48b61a98567a28dee0c701`
- `lib/home-progress.js`: `609ec0d28116fca7d79d2d26ce7a555c8a788b5be2b137b06af253dc9ecb0f14`
- `lib/data-safety.js`: `26edc239e72165427aa1322ffc5f7bd654e50a5f7d0e6fcc80ed19ed7b0c51e6`
- `privacy.html`: `5b01cbe5591fe396f44cfdb19aaff4b5a894d340fc65b1d7293999246fe77749`
- `deploy/public-files.json`: `83ca3546402748fdd44817d1410b74c5b9e89cd48ac19af7879f9b00bb1c6549`
