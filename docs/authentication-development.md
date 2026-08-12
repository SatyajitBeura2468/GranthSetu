# Operator Authentication Development Guide

## Scope

Phase 4 adds operator-only authentication and authorization for the isolated Supabase Development project `jyvvxseeytjyhuinyzgn` in `ap-south-1`. It does not create Production Auth users, connect Production data, add member/student login, or implement circulation mutations.

## Local configuration

Copy `.env.example` to an ignored `.env.local` and supply only the Development publishable key. Set `SUPABASE_SECRET_KEY` only when testing trusted invitation/bootstrap actions locally. The secret must never be imported by a client component, placed in a `NEXT_PUBLIC_*` variable, logged, or committed. The local Supabase config disables signup and anonymous sign-in and requires passwords of at least 12 characters.

Run `npm run db:start`, `npm run db:reset`, `npm run db:test`, and `npm run db:test:auth` when Docker is available. The Auth/RLS test creates synthetic `@phase4.invalid` users and removes them in cleanup; it does not use school identities or data.

## Operator lifecycle

1. An administrator uses the protected operators page to invite an email through the server-only Supabase Admin API.
2. The server links the invited Auth user to an active profile and fixed role through `admin_provision_operator_profile`.
3. The recipient follows the invite template to `/auth/confirm`, then sets a password at `/update-password`.
4. Administrators can assign/revoke roles or change profile status. Database advisory locking prevents concurrent removal/deactivation of the last active administrator.
5. `current_operator_context()` is the only application context source. Revoked or inactive profiles fail closed even if a stale browser UI remains open.

The first administrator bootstrap RPC is service-role-only and Development-only. It is not exposed as a public route and should be run once through a controlled operator script or SQL session after the Auth user exists.

## Signup onboarding, recovery and redirects

Recovery responses are intentionally generic. New Library Room signup uses `/auth/confirm-library`, which exchanges the confirmation code, revalidates only the non-sensitive Library Room continuation, and calls the authenticated `create_library_room` RPC exactly once. The normal `/auth/confirm` route remains for invite and password-recovery links.

An authenticated user with no operator room may use `/create-library`â€™s onboarding-only **Sign in to continue** flow to finish a saved room request. Ordinary `/login` remains operator-only and signs a no-room account back out. Resend uses Supabase Authâ€™s signup resend endpoint; the UI does not claim delivery or reveal whether an address exists.

Callback paths are sanitized and restricted to same-origin application paths. Invite and recovery templates contain token placeholders only; passwords, token hashes, cookies, and email addresses are not logged. Hosted Auth must allow the exact production callback `https://granthsetu.vercel.app/auth/confirm-library` (alongside the existing generic callback) and its signup confirmation template must preserve Supabaseâ€™s confirmation URL. Verify hosted SMTP/delivery and redirect settings independently before claiming hosted email readiness.

## Authorization boundary

RLS grants authenticated SELECT only to active operators for operational/reference tables and to administrators for profiles, profile roles, and audit events. No direct authenticated INSERT/UPDATE/DELETE is granted. Security changes run through narrow RPCs and are audited. The browser is not a security boundary.

## Not supplied or not yet enabled

No original Apps Script backend is part of V3. No hosted operator account, secret value, or Production configuration is committed. No MFA, OAuth, passwordless login, member self-service, email automation beyond Auth templates, or business mutation RPCs are included in Phase 4.
