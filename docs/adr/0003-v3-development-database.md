# ADR 0003: GranthSetu V3 Development Database

## Status

Accepted for the Development database implementation. Production infrastructure remains explicitly deferred.

## Context

The V3 domain and security architecture is accepted. GranthSetu now needs a reproducible PostgreSQL foundation without real school data, authentication flows, or LMS business workflows.

## Decision

Create exactly one isolated Supabase project, `granthsetu-dev`, in `ap-south-1` (Mumbai). Keep Git migrations and synthetic seed data as the schema source of truth. Use UUID primary keys, separate human identifiers, UTC-aware timestamps, constrained text domain values, normalized title/copy/catalogue relationships, integer minor-unit INR money, and archival rather than destructive history loss.

Enable RLS on every application table in the exposed public schema. Until authentication and role plumbing exist, grant no broad `anon` or `authenticated` table access and create no permissive policies. Keep privileged keys server-only and do not configure them for this phase.

Use local Supabase/Docker validation, pgTAP tests, database linting, and generated TypeScript public-schema types. Seed only fake Development records, never real Auth users or school data.

## Rationale

This arrangement makes a new database reproducible from version control, keeps Preview and Development isolated from Production, prevents accidental browser data access while authorization is incomplete, and provides a stable typed foundation for the next authentication/security phase.

## Consequences

Schema changes require reviewed migrations, clean resets, tests, linting, and type regeneration. The local stack requires Docker. Environment values must remain separately scoped, and the hosted Development project must never become an undocumented schema authoring surface.

## Deferred

Authentication, complete administrator/librarian RLS policies, trusted issue/return/renew/fine functions, actual school loan/fine policy values, member self-service, reservations/payments/acquisition/stocktake modules, real data migration, and Production Supabase infrastructure.
