# Feature idea: Sign-in upgrade (dedicated view + OAuth + branded emails)

Status: **frontend complete and production email templates live (2026-06-28);
Google/Apple OAuth credentials remain to be configured (checklist below).**

## What shipped

- **Dedicated sign-in view.** The header "Sign in" affordance and the settings
  popover's "Sign in" button both open a focused modal (`#signin-overlay`,
  styled on the existing `detail-overlay`/`detail-sheet` pattern) instead of an
  inline email field. The inline `settings-auth-email` input is gone.
- **Multiple methods without broken rollout states.** The view always offers an
  email **magic link**. It reads `/auth/v1/settings` and shows **Continue with
  Google** / **Continue with Apple** only when the hosted project reports those
  providers enabled. Google/Apple go through
  `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`; the
  magic link still uses `signInWithOtp`.
- **Branded transactional emails.** Monochrome StackRank templates live in
  `supabase/templates/` (magic_link, confirmation, recovery, email_change) and
  are wired into `supabase/config.toml` with branded subject lines. The four
  exact template bodies, subjects, and `StackRank` sender name are live in the
  hosted project through the Supabase Management API.
- **Pure logic + tests.** `lib/auth.js` owns the redirect-URL rule (`/movies` on
  production and route-aware previews, root-based localhost support, and the
  exact legacy GitHub Pages host exception), email validation, and hosted
  provider availability; `tests/auth.test.js` covers them. The browser smoke
  also covers modal entry/exit, provider visibility, validation, focus return,
  focus wrapping, and mobile geometry. Auth init, `getSession` timeout fallback,
  origin-scoping, and merge-on-load are unchanged.

## Security posture (unchanged guarantees)

- No passwords. Sign-in is passwordless (magic link) or delegated to the OAuth
  provider; StackRank never handles credentials.
- OAuth client **secrets are never committed.** `config.toml` references them via
  `env(...)`; they live in `supabase/.env` locally and in the dashboard for
  production.
- RLS still scopes every row to `list_id = 'user:' || auth.uid()`. New providers
  produce the same `auth.uid()` shape, so no policy changes are needed.
- `redirectTo` is the canonical `/movies` path on production and route-aware
  previews, the current origin for root-based local development, and the known
  repository path on the exact GitHub Pages recovery host; Supabase applies the
  hosted redirect allowlist.

## Production rollout checklist

Provider setup needs account-level access to the Google/Apple consoles plus the
Supabase dashboard for project `hrfhakrxsllrqmscxxpb`.

- [ ] **Google.** Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
   Client ID (Web application). Authorized redirect URI:
   `https://hrfhakrxsllrqmscxxpb.supabase.co/auth/v1/callback`. Copy the client
   ID + secret into Supabase dashboard → Authentication → Providers → Google.
   Configure and publish the OAuth consent screen as appropriate.
- [ ] **Apple.** Requires a paid Apple Developer account. Create an App ID + a
   Services ID (this is the `client_id`), enable "Sign in with Apple", add the
   return URL `https://hrfhakrxsllrqmscxxpb.supabase.co/auth/v1/callback`, create
   a Sign in with Apple key (.p8), and generate the client secret JWT. Paste
   Services ID + secret into Supabase dashboard → Authentication → Providers →
   Apple. (Apple secrets expire ≤6 months — set a reminder to rotate.)
- [ ] **Movies URL cutover.** After Vercel serves `/movies`, set the hosted Site
   URL to `https://www.stackrankapp.com/movies`. The additional redirect URLs
   should retain the old production roots during transition and include apex
   `/movies`, the Vercel preview wildcard, the legacy GitHub Pages URL,
   localhost:8000/3000, and the current LAN test URL.
- [x] **Email templates.** Applied via the Management API and verified
   byte-for-byte against `supabase/templates/*.html`; subjects and sender name
   were also verified.
- [ ] **Production smoke.** After provider credentials are configured, test
   Google and Apple round trips. Send a real magic link to a controlled address
   and confirm the branded email renders correctly in Gmail and Apple Mail.

## Notes / follow-ups

- GitHub OAuth was considered and deferred (Dan chose Google + Apple + magic
  link). Adding it later requires a new provider entry/button and a provider
  block in `config.toml`.
- No auth telemetry was added (would require extending the `product_events`
  allowlist + a migration). Could add `sign_in_opened` / `sign_in_method` later
  if we want funnel data — see `product-instrumentation.md`.
