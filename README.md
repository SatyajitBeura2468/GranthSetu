# GranthSetu

GranthSetu is the evolving library management platform for OAV Musiguda.

## Current stage

GranthSetu V3 platform foundation is under active development. The repository now contains a minimal Next.js App Router application, a health endpoint, strict TypeScript tooling, CI, Vercel-ready deployment structure, and Supabase-ready utilities.

The V3 LMS is not finished. No books, members, issue/return workflows, reports, authentication flows, domain tables, or school data have been implemented.

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
- [Deployment guide](docs/deployment.md)
- [Security baseline](docs/security-baseline.md)
- [Data migration plan](docs/data-migration-plan.md)

## Status

V3 platform foundation under active development. Historical V2 preserved unchanged. The temporary homepage exists only to prove that the new application stack builds and deploys.
