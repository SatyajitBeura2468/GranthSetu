# ADR 0004: V3 Operator Authentication and Authorization

## Status

Accepted for Phase 4 implementation on the isolated `granthsetu-dev` project. Production is out of scope.

## Decision

GranthSetu uses Supabase Auth email/password identities for approved operators only. Public signup, anonymous sign-in, OAuth, student/member authentication, and self-service role selection are disabled. The identity chain is `auth.users` → `profiles.auth_user_id` → active profile → `profile_roles` → fixed `roles.role_key` values (`administrator` and `librarian`). Authorization is derived from database state, never from editable Auth metadata or hidden controls.

The Next.js App Router refreshes cookies in `src/proxy.ts` using the Supabase SSR client and verifies claims with `getClaims()`. Server actions perform the authoritative role check again. The privileged `SUPABASE_SECRET_KEY` is accepted only in server-only code, only for the approved Development project, and is never sent to the browser.

Phase 4 grants authenticated operators narrow read access through RLS and exposes security-definer RPCs for administrator-controlled provisioning, role changes, status changes, and Development-only first-admin bootstrap. Direct authenticated table writes and circulation mutation RPCs remain closed. Successful security changes create minimal audit events.

## Consequences

Operator access can be revoked or deactivated in the database and becomes ineffective on the next verified request. Email invitation and recovery links use local templates and an allowlisted application callback. A trusted server secret is still required to invite Auth users; no secret or real operator was added by this change. Business workflows and their mutation authorization remain later phases.
