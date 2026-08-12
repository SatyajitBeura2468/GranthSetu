# GranthSetu V3 deployment runbook

## Release topology

- Repository: `SatyajitBeura2468/GranthSetu`
- Production branch: `main`
- Vercel project: `granthsetu`
- Canonical web host: `https://granthsetu.vercel.app`
- Production database: existing Supabase project `jyvvxseeytjyhuinyzgn` (historical display name may be `granthsetu-dev`)

The web deployment and data-plane migration are independent. Local Supabase is Development with synthetic data only; GitHub Actions is disposable local CI/staging; the hosted project above is Production-only. No hosted development or Preview environment is used under the current Free-plan constraint. Never copy Production credentials to local development or GitHub Actions.

## Required environment variables

| Name | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Exact approved project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Publishable or anon key for that project |
| `SUPABASE_SECRET_KEY` | Server only | Secret/service key; never prefix with `NEXT_PUBLIC_` |
| `SUPABASE_EXPECTED_PROJECT_REF` | Server only | Optional fail-closed match for the approved project ref |
| `NEXT_PUBLIC_SITE_URL` | Browser/server | Exact canonical origin, without a trailing slash |

Production values are scoped to Vercel Production only. Confirm variable names and targets without printing secrets into logs. No Preview configuration, deployment, or release check is part of this workflow.

For Production, set `NEXT_PUBLIC_SITE_URL=https://granthsetu.vercel.app` exactly. The application fails closed for auth callbacks when this value is absent or invalid in a production build; it never substitutes localhost. In Supabase Auth URL Configuration, set the Site URL to the same canonical origin and allow `https://granthsetu.vercel.app/auth/confirm` as a Redirect URL. Supabase accepting a signup request does not prove email delivery; reliable delivery may require configuring an approved custom SMTP provider in the Supabase dashboard.

## Pre-deployment gates

1. Confirm a clean working tree and intended commit.
2. Run `npm ci`, lint, type-check, money/localization contracts, UI/onboarding contracts, browser E2E, and a production build on Node 24.
3. Start local Supabase, reset from zero, lint the database, and run all pgTAP suites including `db:test:tenancy`.
4. Generate `src/types/database.ts` from the reset schema and rerun the web gates. CI requires `validate`, `database`, and `e2e` jobs.
5. Inspect `/`, `/l/OAVMUSI`, catalogue/detail, staff/login/create-library, and every operator area at desktop and mobile widths.
6. Test keyboard focus, light/dark themes, reduced motion, empty/error states, redirects, CSV export, and no-console-error behavior.

## Production database safety and release procedure

For every production migration:

1. Create a feature branch and write a forward-only migration.
2. Run the local reset/test suite with synthetic data.
3. Push a PR; require green `validate`, `database`, and `e2e` jobs.
4. Review the migration and merge `main`.
5. Confirm the target project ref exactly equals `jyvvxseeytjyhuinyzgn` through independent signals.
6. Take or verify a recoverable backup, run migration-list/dry-run equivalent, and apply only pending migrations.
7. Rerun advisors, verify production health and headers, then run a controlled non-destructive smoke.

Forbidden: `supabase db reset --linked` against Production, production `--include-seed`, fixtures/pgTAP/E2E against Production, manual dashboard schema drift, and ad-hoc destructive SQL.

## Free-tier production backups

An approved operator takes a schema dump and a data-only logical dump using Supabase/Postgres tooling with credentials kept outside the repository. Store encrypted dumps outside Git with a documented retention rotation. Record whether Auth users and Storage objects/metadata require separate export procedures, and perform a periodic restore drill into an isolated non-production target. Never commit dumps, use public artifacts, or expose database secrets in CI logs. A scheduled backup is permitted only when secrets remain in encrypted secret storage and the resulting encrypted backup has private, short-retention storage.

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

Then test one synthetic room end to end: public discovery, catalogue search, room login, issue, return, renewal, member creation, catalogue creation, inventory creation, report export, operator assignment, and audit visibility. Use USD/en-US/America/New_York for the production smoke room, test a rapid duplicate renewal and a duplicate member or book submit, and retain only clearly synthetic data.

Vercel Production uses Node 24 and `bom1` through `vercel.json`. Verify the production response contains CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy`, with no `X-Powered-By` and no CSP `unsafe-eval`.

## Rollback

- Web: use Vercel's previous known-good deployment; do not rewrite Git history.
- Database: stop writes and use the reviewed backup/restore plan. This migration changes keys and foreign keys, so do not improvise a destructive down migration on live records.
- Credentials: rotate any secret exposed in logs and redeploy every affected environment.
