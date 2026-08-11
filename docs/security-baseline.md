# GranthSetu V3 Security Baseline

The Development database baseline and Phase 4 operator authentication/authorization are implemented for the isolated Development project. These are non-negotiable principles:

- Real student/member data never belongs in Git.
- Secrets never belong in Git.
- Preview and production databases remain isolated.
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
- Production data is never used casually in Preview deployments.
- Credentials and services follow least privilege.
- Migrations are repeatable, reviewable, and reversible.
- Every important workspace write includes a stable client logical-request UUID. The trusted database gateway validates actor and room, acquires a transaction advisory lock, and replays the canonical receipt result for retries. Receipt rows have RLS enabled and no direct browser privileges.
- Room-local currency, locale, and timezone are non-sensitive public identity fields; member, operator, audit, and private setting data remain non-public.

The current repository contains no real school data, Supabase secret, database password, or Production connection. The isolated `granthsetu-dev` project is the only Development database target, and Vercel Production must remain without Supabase credentials. Hosted Auth settings and an initial administrator require an independently verified authenticated setup step.
