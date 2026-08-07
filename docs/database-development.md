# GranthSetu V3 Database Development

## Environment boundary

GranthSetu has one isolated Development Supabase project:

- Project: `granthsetu-dev`
- Project ref: `jyvvxseeytjyhuinyzgn`
- Region: `ap-south-1` (Mumbai), the available South Asian region closest to Odisha
- Purpose: disposable Development validation and synthetic data only

There is no Production Supabase project. Vercel Preview may use Development credentials; Vercel Production must remain without Supabase credentials until a later approved phase. Never place a database password, secret key, service-role key, or access token in this document or Git.

## Source of truth

The repository is the schema source of truth. Ordered SQL files under `supabase/migrations/` define the database. `supabase/seed.sql` contains only obviously synthetic Development data. The hosted project is a deployment target, not a place to author untracked schema changes.

The initial schema intentionally has no complete authentication policies, student self-service, circulation RPCs, or real school policy values. Every table in the exposed `public` schema has RLS enabled and the browser roles have no broad table privileges or policies, so the baseline fails closed.

## Local setup

The pinned CLI version is `2.112.0` and is invoked through `npx` so a developer does not depend on an uncontrolled global install:

```text
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
npm run db:types
```

The local Supabase stack requires a Docker-compatible runtime. `db reset` recreates the local database from all migrations and then applies `supabase/seed.sql`; it is the reproducibility check for a clean database. Do not use a remote reset as a routine local command.

## Migration workflow

1. Update the approved design or obtain the required policy approval.
2. Create a migration with `npx supabase@2.112.0 migration new <descriptive_name>`.
3. Write and review the SQL in `supabase/migrations/`.
4. Run `npm run db:reset`, `npm run db:test`, and `npm run db:lint`.
5. Regenerate `src/types/database.ts` with `npm run db:types` and review the diff.
6. Commit the migration, tests, generated types, and documentation together.
7. Review `npx supabase@2.112.0 db diff --local` or the current CLI equivalent for unexplained drift before publishing.

For a linked Development project, authenticate with the CLI, link using its project ref, preview with `npx supabase@2.112.0 db push --dry-run`, and apply with `npx supabase@2.112.0 db push`. Use `--include-seed` only for a disposable Development target. Never run `db reset --linked` without independently verifying the linked project is the throwaway Development project.

## Testing and linting

Database tests use pgTAP under `supabase/tests/database/` and run with `npm run db:test`. They cover table existence, keys, relationship support, lifecycle checks, the one-active-loan-per-copy concurrency constraint, money arithmetic, and the fail-closed RLS/grant baseline. `npm run db:lint` runs the pinned CLI's local database linting at error level.

GitHub Actions runs the same local Supabase reset, pgTAP tests, lint, and generated-type drift check in an ephemeral Ubuntu environment. CI does not connect to `granthsetu-dev` and does not require Supabase secrets.

## Type generation

The committed generated public-schema types are at `src/types/database.ts`. Regenerate them after every migration with:

```text
npm run db:types
```

The browser and server Supabase utilities use `Database` as their client generic. This adds type safety without adding queries, authentication, or business workflows.

## Synthetic seed

The seed contains fake `DEV-*` members, profiles without Auth users, catalogue records, multiple copies, lifecycle states, historical and active loans, a renewal, a normalized INR fine example, and a disabled-fines setting. It contains no real student, teacher, librarian, contact, Google Sheet, or production record. The seed is for local/Development testing and is not an authoritative school-policy configuration.

## Remote Development verification

The current Development project was created only after account, organization, project-name, region, and cost checks. Its migration history must exactly match the ordered set of version-controlled SQL migrations under `supabase/migrations/`. The repository migration set remains the source of truth; the hosted Development database must not contain unexplained migration drift. Before any future push, inspect migration history, tables, constraints, RLS, privileges, policies, and synthetic row counts. Resolve drift by adding a reviewed migration; do not edit the Dashboard and leave the change uncaptured.

## Secret handling

- Public application values use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
- `SUPABASE_SECRET_KEY` is reserved for a future trusted server-only use and is not configured by this phase.
- Never expose a secret/service-role key through `NEXT_PUBLIC_*`, browser code, generated types, CI logs, Preview client bundles, or Git.
- Local values belong in ignored `.env.local`; `.env.example` contains names only.

## Production prohibition

Do not create `granthsetu-prod`, a staging project, Production Vercel Supabase variables, real Auth users, real school data, or a production migration pipeline in this phase. The next security phase must approve authentication, complete administrator/librarian RLS policies, trusted business mutation functions, and environment handling before Production is considered.
