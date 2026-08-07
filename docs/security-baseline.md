# GranthSetu V3 Security Baseline

The Development database baseline is implemented, but complete authentication and authorization are still deferred. These are non-negotiable principles:

- Real student/member data never belongs in Git.
- Secrets never belong in Git.
- Preview and production databases remain isolated.
- Privileged Supabase keys are server-only and never use `NEXT_PUBLIC_` names.
- Future authorization is enforced server-side; hiding a button is not authorization.
- Row Level Security is enabled on every current application table, with no broad permissive browser policies.
- Anonymous and authenticated roles have no broad public-schema table privileges at this stage; the baseline fails closed.
- Student self-service is deferred; only administrator and librarian roles are defined.
- Future admin actions require authenticated, server-enforced authorization.
- Future email operations run server-side.
- Future circulation mutations are validated server-side.
- Future audit logs are immutable from normal users.
- Production data is never used casually in Preview deployments.
- Credentials and services follow least privilege.
- Migrations are repeatable, reviewable, and reversible.

The current repository contains no real school data, Supabase secret, database password, or Production connection. The isolated `granthsetu-dev` project is the only Development database target, and Vercel Production must remain without Supabase credentials.
