# GranthSetu V3

**One platform. Every library. One room at a time.**

GranthSetu is a global, multi-tenant library platform for schools and community libraries. A short public code opens a library's anonymous catalogue; authenticated librarians and administrators enter a room-scoped operational workspace for circulation, catalogue, inventory, members, reporting, and governance.

The historical OAV Musiguda Library is preserved as the deterministic bootstrap room `OAVMUSI`. The original V2 frontend remains immutable in [`legacy/original-v2/`](legacy/original-v2/).

## Product surfaces

| Surface | Route | Access |
| --- | --- | --- |
| Global gateway | `/` | Public |
| Library room | `/l/[libraryCode]` | Public |
| Catalogue | `/l/[libraryCode]/catalogue` | Public, deliberately narrow data |
| Staff entry | `/staff` | Public entry point |
| Room login | `/l/[libraryCode]/login` | Supabase Auth |
| Create a library | `/create-library` | Auth-backed onboarding |
| Operator workspace | `/operator/[libraryCode]` | Assigned librarian or administrator |
| Room administration | `/operator/[libraryCode]/admin/*` | Assigned administrator |

Public library codes locate a room; they never authorize it. Every private read and mutation is revalidated against the authenticated profile, room assignment, and role in PostgreSQL.

## Experience direction

The interface uses a calm editorial-library system: Instrument Sans for utility, Newsreader for knowledge-led headings, deep forest ink, warm paper surfaces, and a coral action accent. The page-bridge motif links the global gateway, public rooms, and dense operator workspace without reducing the product to a generic card dashboard. Light and dark themes, reduced motion, keyboard focus, touch targets, mobile navigation, empty/error states, and semantic tables are first-class.

See [`docs/ui-design-system.md`](docs/ui-design-system.md) for tokens and interaction rules.

## Architecture

- Next.js 16 App Router, React 19, strict TypeScript
- Tailwind CSS 4 plus a purpose-built CSS design system
- Supabase Auth, PostgreSQL, Row Level Security, and private Storage
- Trusted room-scoped RPCs for operator reads and mutations
- Narrow anonymous RPCs for public library discovery and catalogue data
- Vercel deployment from `main`

The tenancy migration is [`supabase/migrations/20260809075709_global_library_room_tenancy.sql`](supabase/migrations/20260809075709_global_library_room_tenancy.sql). It assigns every existing tenant-owned row to the bootstrap room, changes natural keys to room-local uniqueness, and adds composite foreign keys that reject cross-room relationships.

## Local development

Requirements: Node.js 20+, npm, and Docker Desktop or Podman for local Supabase.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:start
npm run db:reset
npm run dev
```

Open `http://127.0.0.1:3000`. When Supabase variables are intentionally absent in development, `OAVMUSI` exposes clearly labelled synthetic demonstration data; production never falls back to that data.

## Validation

```powershell
npm run lint
npm run typecheck
npm run test:phase71:ui
npm run build
npm run db:lint
npm run db:test
npm run db:test:tenancy
```

Database commands require the local Supabase containers. Do not apply migrations to an unknown or unreviewed Production project. The synthetic seed contains no school records or policy claims.

## Environment

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_EXPECTED_PROJECT_REF=
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

Only the `NEXT_PUBLIC_` variables may enter browser bundles. `SUPABASE_SECRET_KEY` is server-only and is used for bounded tasks such as signing an already-public book cover. `SUPABASE_EXPECTED_PROJECT_REF` is an optional fail-closed check that must match the subdomain in the configured Supabase URL. Store all real values in `.env.local` or the deployment provider; never commit them.

## Documentation

- [Domain model](docs/domain-model.md)
- [Security and authorization](docs/security-authorization-model.md)
- [Library onboarding](docs/library-onboarding.md)
- [UI design system](docs/ui-design-system.md)
- [Database development](docs/database-development.md)
- [Deployment runbook](docs/deployment.md)
- [Global Library Room tenancy ADR](docs/adr/0010-global-library-room-tenancy.md)
- [Functional completion matrix](docs/v3-functional-completion.md)

## Release boundary

Source, migration, tests, and the web deployment are separate gates. A green web build does not prove that a hosted database was migrated. Production data-plane readiness requires a reviewed target project, backup, migration rehearsal, generated types, tenancy tests, and synthetic end-to-end checks before real records are admitted.
