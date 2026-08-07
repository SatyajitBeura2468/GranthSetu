# GranthSetu

GranthSetu is the evolving library management platform for OAV Musiguda.

## Current stage

GranthSetu V3 platform foundation is under active development. The repository now contains a minimal Next.js App Router application, a health endpoint, strict TypeScript tooling, CI, Vercel-ready deployment structure, and Supabase-ready utilities.

The V3 LMS is not finished. Phase 4 now provides operator-only Supabase Auth, server-side session refresh, database-authoritative administrator/librarian authorization, recovery routes, and administrator-controlled operator access. Books, members, issue/return workflows, reports, and business mutation workflows remain future phases.

## Historical V2 baseline

The original OAV Musiguda LMS Pro v2 frontend remains preserved and immutable under [`legacy/original-v2/`](legacy/original-v2/). It is a single-file Google Apps Script HTML frontend and remains available as a historical reference. The original server-side Apps Script source was not supplied.

Read the [current system baseline](docs/current-system-baseline.md) and [import manifest](legacy/original-v2/IMPORT_MANIFEST.md) for the preserved implementation and provenance.

## V3 direction

The intended architecture is:

- Next.js App Router
- React and strict TypeScript
- Vercel with GitHub Preview Deployments
- Supabase-ready server and browser utilities
- PostgreSQL and domain schema designed in a later phase

Preview/Development must remain isolated from any future production school database. Google Sheets and Google Apps Script are not the primary V3 runtime.

## Foundation documentation

- [V3 platform ADR](docs/adr/0001-v3-platform-foundation.md)
- [V3 domain model](docs/domain-model.md)
- [V3 security and authorization model](docs/security-authorization-model.md)
- [V3 domain/security ADR](docs/adr/0002-v3-domain-security-model.md)
- [Database development guide](docs/database-development.md)
- [V3 development database ADR](docs/adr/0003-v3-development-database.md)
- [Deployment guide](docs/deployment.md)
- [Security baseline](docs/security-baseline.md)
- [Operator authentication development guide](docs/authentication-development.md)
- [Operator authentication ADR](docs/adr/0004-v3-operator-auth-authorization.md)
- [Data migration plan](docs/data-migration-plan.md)

## Status

V3 Phase 4 operator authentication and authorization under active development. Historical V2 preserved unchanged. Production Auth, real school data, and business workflows are not enabled.
