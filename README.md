# GranthSetu

GranthSetu is the evolving library management platform for OAV Musiguda.

## Current stage

GranthSetu V3 platform foundation is under active development. The repository now contains a minimal Next.js App Router application, a health endpoint, strict TypeScript tooling, CI, Vercel-ready deployment structure, and Supabase-ready utilities.

Phase 5 provides the trusted circulation engine. Phase 6/7 foundations now provide operator catalogue, reference, private cover-storage, inventory, member/enrollment, policy, search, dashboard, report/CSV, and administrator audit workflows through trusted database operations. The functional matrix and honest validation boundary are recorded in [`docs/v3-functional-completion.md`](docs/v3-functional-completion.md).

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

## Operator workflow

- `/operator/catalogue` — books, authors, publishers, categories, subjects, and covers
- `/operator/inventory` — physical copies, accession numbers, locations, and lifecycle state
- `/operator/members` — member identity, status, and student enrollment
- `/operator/circulation` — issue, return, renewal, fines, settlement, and waiver
- `/operator/settings` — administrator-only policy and academic structure
- `/operator/reports` — circulation, overdue, popular books, member activity, inventory, fines, and safe CSV exports
- `/operator/admin/audit` — administrator-only append-oriented audit viewer

## Status

V3 functional foundation is implemented on the reviewed branches; visual polish, production/real-data migration, and deferred product features remain separate work. Historical V2 is preserved unchanged. Hosted Development verification was not performed because authenticated Supabase management access was unavailable.
