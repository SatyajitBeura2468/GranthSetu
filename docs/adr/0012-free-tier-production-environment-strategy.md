# ADR 0012: Free-tier production environment strategy

## Status

Accepted — 2026-08-12.

## Decision

`jyvvxseeytjyhuinyzgn` is GranthSetu's canonical Production Supabase project. Its historical dashboard display name may remain `granthsetu-dev`; the immutable project ref, not that label, identifies the target. The existing project already serves `https://granthsetu.vercel.app`, so this is a role reclassification, not a database migration or rebuild.

Local Supabase is the development environment and contains synthetic data only. GitHub Actions starts disposable local Supabase for validation, pgTAP, Auth/RLS, circulation, localization/idempotency, and Playwright tests, then destroys it. After the required CI jobs pass, `main` deploys directly to Vercel Production, which alone uses the hosted project and real production data. No Preview environment is part of this release workflow.

Production schema changes are forward-only migrations: local reset and tests, PR, green CI and review, merge, target-ref verification, pending-migration review, then apply only the pending migration. Never reset a linked production database, seed it, run fixtures/pgTAP/E2E against it, or make ad-hoc dashboard schema changes.

## Consequences

This uses the current two-hosted-project Free-plan constraint without creating a third project, copying data, changing the project ref, or altering GranthSetu's tenant/Auth/RLS/RPC architecture. Production backups are mandatory and are stored encrypted outside Git; restore drills are part of operations.

A future paid plan can add dedicated hosted staging, database branching, stronger backup guarantees, and additional Auth protections without changing the application domain architecture.
