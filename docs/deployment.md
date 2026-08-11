# GranthSetu V3 deployment runbook

## Release topology

- Repository: `SatyajitBeura2468/GranthSetu`
- Production branch: `main`
- Vercel project: `granthsetu`
- Canonical web host: `https://granthsetu.vercel.app`
- Database: a separately reviewed Supabase project per environment

The web deployment and data-plane migration are independent. Never copy a Development database credential into Production merely to make a deployment appear complete.

## Required environment variables

| Name | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Exact approved project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Publishable or anon key for that project |
| `SUPABASE_SECRET_KEY` | Server only | Secret/service key; never prefix with `NEXT_PUBLIC_` |
| `SUPABASE_EXPECTED_PROJECT_REF` | Server only | Optional fail-closed match for the approved project ref |
| `NEXT_PUBLIC_SITE_URL` | Browser/server | Exact canonical origin, without a trailing slash |

Use separate values for Local, Preview, and Production. Confirm variable names and targets without printing secrets into logs.

For Production, set `NEXT_PUBLIC_SITE_URL=https://granthsetu.vercel.app` exactly. The application fails closed for auth callbacks when this value is absent or invalid in a production build; it never substitutes localhost. In Supabase Auth URL Configuration, set the Site URL to the same canonical origin and allow `https://granthsetu.vercel.app/auth/confirm` as a Redirect URL. Supabase accepting a signup request does not prove email delivery; reliable delivery may require configuring an approved custom SMTP provider in the Supabase dashboard.

## Pre-deployment gates

1. Confirm a clean working tree and intended commit.
2. Run `npm ci`, lint, type-check, UI contract tests, and production build.
3. Start local Supabase, reset from zero, lint the database, and run all pgTAP suites including `db:test:tenancy`.
4. Generate `src/types/database.ts` from the reset schema and rerun the web gates.
5. Inspect `/`, `/l/OAVMUSI`, catalogue/detail, staff/login/create-library, and every operator area at desktop and mobile widths.
6. Test keyboard focus, light/dark themes, reduced motion, empty/error states, redirects, CSV export, and no-console-error behavior.

## Production database gate

Before applying the V3 tenancy migration:

1. Identify the exact Supabase project and owner.
2. Take a recoverable backup and record its timestamp.
3. Confirm the source schema matches the reviewed migration base.
4. Rehearse the migration against a restored copy.
5. Verify every tenant-owned table maps existing rows to `OAVMUSI` and no primary IDs change.
6. Run the isolation matrix with two synthetic rooms and two users.
7. Apply only through the approved migration workflow; never via ad-hoc dashboard edits.
8. Generate types from the migrated target and retain the test evidence.

If any item is unavailable, publish only the web application and label the production data plane pending configuration.

## Web release and smoke test

After all applicable gates are green, push the reviewed commit to `main`. Vercel Git integration should create the Production deployment. Verify:

```text
GET /
GET /api/health
GET /l/NOT-A-ROOM        -> safe 404
GET /staff
GET /create-library
GET /operator            -> authenticated room chooser or /staff redirect
```

Then test one synthetic room end to end: public discovery, catalogue search, room login, issue, return, renewal, member creation, catalogue creation, inventory creation, report export, operator assignment, and audit visibility.

## Rollback

- Web: use Vercel's previous known-good deployment; do not rewrite Git history.
- Database: stop writes and use the reviewed backup/restore plan. This migration changes keys and foreign keys, so do not improvise a destructive down migration on live records.
- Credentials: rotate any secret exposed in logs and redeploy every affected environment.
