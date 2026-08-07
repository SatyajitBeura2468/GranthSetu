# GranthSetu V3 Security Baseline

This foundation does not implement the complete authentication or authorization system. These are non-negotiable design principles for later phases:

- Real student/member data never belongs in Git.
- Secrets never belong in Git.
- Preview and production databases remain isolated.
- Privileged Supabase keys are server-only and never use `NEXT_PUBLIC_` names.
- Future authorization is enforced server-side; hiding a button is not authorization.
- Row Level Security is deliberately designed before production tables are exposed.
- Future admin actions require authenticated, server-enforced authorization.
- Future email operations run server-side.
- Future circulation mutations are validated server-side.
- Future audit logs are immutable from normal users.
- Production data is never used casually in Preview deployments.
- Credentials and services follow least privilege.
- Migrations are repeatable, reviewable, and reversible.

The current repository contains no real school data, Supabase secret, database password, or production connection.
