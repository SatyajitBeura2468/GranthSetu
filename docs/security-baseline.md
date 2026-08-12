# GranthSetu V3 Security Baseline

The Development database baseline and Phase 4 operator authentication/authorization are implemented for the isolated Development project. These are non-negotiable principles:

- Real student/member data never belongs in Git.
- Secrets never belong in Git.
- Local/CI and production databases remain isolated.
- Privileged Supabase keys are server-only and never use `NEXT_PUBLIC_` names.
- Future authorization is enforced server-side; hiding a button is not authorization.
- Row Level Security is enabled on every current application table, with no broad permissive browser policies.
- Anonymous and authenticated roles have no broad public-schema table privileges at this stage; the baseline fails closed.
- Student self-service is deferred; only administrator and librarian roles are defined.
- Future admin actions require authenticated, server-enforced authorization.
- Public email signup creates an unprivileged identity; anonymous sign-in is disabled. Only a trusted Library Room creation or room-local administrator assignment can grant operator authority.
- Roles are fixed database assignments (`administrator` and `librarian`) resolved through profiles and profile_roles, never user metadata.
- RLS permits narrow authenticated SELECT access and denies direct browser writes; sensitive access changes run through audited administrator RPCs.
- Future email operations run server-side.
- Future circulation mutations are validated server-side.
- Future audit logs are immutable from normal users.
- Production data is never used for development or CI validation.
- Credentials and services follow least privilege.
- Migrations are repeatable, reviewable, and reversible.
- Every important workspace write includes a stable client logical-request UUID. The trusted database gateway validates actor and room, acquires a transaction advisory lock, and replays the canonical receipt result for retries. Receipt rows have RLS enabled and no direct browser privileges.
- Room-local currency, locale, and timezone are non-sensitive public identity fields; member, operator, audit, and private setting data remain non-public.

The repository contains no real school data, Supabase secret, database password, or committed Production connection. `jyvvxseeytjyhuinyzgn` is the canonical GranthSetu Production Supabase project; its historical display name may still be `granthsetu-dev`. The project ref, not the display name, defines the target. Local Supabase is Development, GitHub Actions Supabase is disposable CI/staging, and hosted Supabase is Production. Vercel Production holds the approved project credentials; local development and CI must not receive them.

`workspace_mutation_receipts` intentionally has RLS enabled with no browser policies and direct privileges revoked. This can appear as an advisor information finding; it is deliberate. Trusted security-definer RPCs and `service_role` access it only where required.

Leaked-password protection is a platform Auth capability, not a SQL feature. If it is unavailable on the current Free plan, it is an accepted upgrade trigger before higher-risk institutional scaling; GranthSetu retains its application password minimum and does not emulate the provider feature in SQL.
