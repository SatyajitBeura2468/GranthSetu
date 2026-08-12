# GranthSetu V3 Database Development

## Environment boundary

GranthSetu has no hosted Development or Preview database. Local Supabase is Development and GitHub Actions starts a disposable local Supabase stack for CI/staging; both use synthetic data only. The existing hosted project `jyvvxseeytjyhuinyzgn` in `ap-south-1` is canonical Production. Its historical display name may remain `granthsetu-dev`; the project ref is authoritative. Never place a database password, secret key, service-role key, or access token in this document or Git.

## Source of truth

The repository is the schema source of truth. Ordered SQL files under `supabase/migrations/` define the database. `supabase/seed.sql` contains only obviously synthetic Development data. The hosted project is a deployment target, not a place to author untracked schema changes.

The Phase 4 migration adds operator authentication context, narrow operator/admin SELECT policies, and audited security RPCs. Student self-service, circulation RPCs, direct browser writes, and real school policy values remain out of scope. Every table in the exposed `public` schema has RLS enabled.

## Local setup

The pinned CLI version is `2.112.0` and is invoked through `npx` so a developer does not depend on an uncontrolled global install:

```text
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:test:auth
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

After a reviewed PR has green `validate`, `database`, and `e2e` jobs and has merged to `main`, an approved operator may authenticate with the CLI, verify the linked project ref is exactly `jyvvxseeytjyhuinyzgn`, inspect `db push --dry-run` or the current migration-list equivalent, and apply only pending migrations. Never use `--include-seed` on Production and never run `db reset --linked` against it.

## Testing and linting

Database tests use pgTAP under `supabase/tests/database/` and run with `npm run db:test`. They cover table existence, keys, relationship support, lifecycle checks, the one-active-loan-per-copy concurrency constraint, money arithmetic, and the fail-closed RLS/grant baseline. `npm run db:lint` runs the pinned CLI's local database linting at error level.

GitHub Actions runs the same local Supabase reset, pgTAP tests, lint, generated-type drift check, and browser tests in an ephemeral Ubuntu environment. CI never connects to Production and does not require Production Supabase secrets.

## Type generation

The committed generated public-schema types are at `src/types/database.ts`. Regenerate them after every migration with:

```text
npm run db:types
```

The browser and server Supabase utilities use `Database` as their client generic. Phase 4 also types the current-context and administrator security RPCs; this adds type safety without exposing a privileged client.

## Synthetic seed

The seed contains fake `DEV-*` members, profiles without Auth users, catalogue records, multiple copies, lifecycle states, historical and active loans, a renewal, a normalized INR fine example, and a disabled-fines setting. It contains no real student, teacher, librarian, contact, Google Sheet, or production record. The seed is for local/Development testing and is not an authoritative school-policy configuration.

## Production migration verification

The repository migration set remains the source of truth. Before an approved production apply, inspect the exact project ref, migration history, tables, constraints, RLS, privileges, policies, and backup evidence. Resolve drift by adding a reviewed migration; do not edit the Dashboard and leave the change uncaptured.

## Secret handling

- Public application values use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
- `SUPABASE_SECRET_KEY` is reserved for trusted server-only invitation/bootstrap actions and is not committed or configured by this repository change.
- Never expose a secret/service-role key through `NEXT_PUBLIC_*`, browser code, generated types, CI logs, or Git.
- Local values belong in ignored `.env.local`; `.env.example` contains names only.

## Phase 4 Auth boundary

The local Auth configuration enables confirmed public email signup, disables anonymous sign-in, and requires 12-character passwords. Signup creates no Library Room role; the trusted room-creation workflow or a room-local administrator assignment is required before an identity can operate a library. `current_operator_context()` derives active roles from database tables. `profiles`, `profile_roles`, and `audit_events` are administrator-readable; operational/reference tables are readable by active operators; direct authenticated writes remain denied. See [authentication development](authentication-development.md).

## Production safety

Do not create another GranthSetu project, copy/rebuild production data, or use Production for tests. Production changes are migration-only: local validation, disposable CI, review, merge, target verification, pending migration apply, advisor checks, and controlled non-destructive smoke.
