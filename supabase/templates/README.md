# StackRank auth email templates

These are the branded transactional email templates Supabase sends for
authentication. They share one monochrome StackRank design (white card on a
light background, ink wordmark, single primary button) and only differ in the
heading / body copy / call-to-action.

| File | Supabase template | When it sends |
| --- | --- | --- |
| `magic_link.html` | Magic Link | The primary flow — `signInWithOtp` (passwordless email sign-in). |
| `confirmation.html` | Confirm signup | First time an email address is used to sign up. |
| `recovery.html` | Reset password | Only if password auth is ever enabled (currently passwordless). |
| `email_change.html` | Change email address | Confirming a new email on an existing account. |

## Template variables

Supabase substitutes Go-template variables at send time. The ones used here:

- `{{ .ConfirmationURL }}` — the action link (already carries the redirect).
- `{{ .Email }}` — the recipient address.
- `{{ .NewEmail }}` — the requested address in the email-change template.
- `{{ .SiteURL }}` — `https://www.stackrankapp.com/`.

## Wiring

`supabase/config.toml` points each `[auth.email.template.*]` at the matching
file via `content_path` and sets the subject line for local development. The
hosted project currently matches these four files and subjects exactly. Future
hosted updates can be applied either:

1. PATCH the project's Auth configuration through the Supabase Management API,
   **or**
2. Paste each file's contents into Supabase dashboard →
   Authentication → Emails → Templates, and set the matching subject.

See `notes/feature-ideas/auth-upgrade.md` for the full rollout checklist
(OAuth provider setup, redirect URLs, SMTP).
