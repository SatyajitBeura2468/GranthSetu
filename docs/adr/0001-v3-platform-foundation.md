# ADR 0001: GranthSetu V3 Platform Foundation

## Status

Accepted for the foundation branch; implementation is intentionally limited to infrastructure.

## Decision

GranthSetu V3 will move its primary runtime direction from Google Apps Script plus Google Sheets toward Next.js, Vercel, and Supabase PostgreSQL. The V2 implementation remains preserved as an immutable historical baseline and is not treated as disposable.

## Rationale

The V3 direction provides clearer separation between frontend, server, and data layers; relational database support; stronger data modelling; a proper foundation for authentication and authorization; branch-based development; automatic Preview Deployments; version-controlled migration changes; future scalability; easier testing; improved maintainability; and reduced coupling to the Apps Script runtime.

## Trade-offs

This introduces more infrastructure, explicit schema and security responsibility, authentication work, data-migration complexity, external service dependencies, and environment-management requirements. These costs are accepted because the system is intended to become a maintainable school library platform rather than remain only a prototype.

## Scope boundary

This ADR does not approve domain tables, real data import, authentication flows, business workflows, or production database creation. Those require later product, data-model, and security decisions.
