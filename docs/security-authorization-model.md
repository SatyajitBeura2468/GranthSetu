# GranthSetu V3 Security and Authorization Model

## Scope

This document defines future security boundaries. It does not implement Supabase Auth, PostgreSQL tables, RLS, policies, or application workflows. All authorization decisions described here must be enforced server-side and, where data is exposed through Supabase, at the database boundary as well.

## Identity concepts

`auth.users` is the Supabase-managed authentication identity. GranthSetu-owned `profiles` stores application identity and lifecycle information. A `member` is a library borrowing identity and may have no login. A profile may optionally link to one member, but authentication and membership remain independent. A librarian can have a staff profile and, if policy permits, also be a member.

Application-specific authorization belongs in application tables and trusted claims, not user-editable `user_metadata`. Passwords, recovery secrets, and credentials belong only to Supabase Auth. Role changes require server-side administrative control and token/session refresh expectations must be documented during implementation.

## Initial roles

- **administrator**: trusted system and security operator.
- **librarian**: day-to-day catalogue, member, inventory, and circulation operator.
- **member/student**: deferred self-service role. If added, it can only access catalogue and its own permitted records.

Role is a capability assignment; it is not a member type, student class, or authentication identity.

## Authorization matrix

| Resource/action | Administrator | Librarian | Member/student (future) |
| --- | --- | --- | --- |
| Read public catalogue and availability | Yes | Yes | Limited, authenticated or approved public policy |
| Create/edit books, authors, categories | Yes | Yes | No |
| Archive books and withdraw copies | Yes | Yes, subject to policy | No |
| Create/edit physical copies and locations | Yes | Yes | No |
| Create/edit/deactivate members | Yes | Yes | No |
| View member PII | Yes | Operational minimum only | Own record only |
| Issue, return, renew loans | Yes | Yes | No; self-service renewals require separate approval |
| View all loans and overdue reports | Yes | Yes | No |
| View own loans/history | Yes | Yes | Own records only if enabled |
| Create/adjust/waive fines | Yes | Yes within approved policy | No |
| Manage profiles, roles, and librarian access | Yes | No | No |
| Manage settings and policies | Yes | Limited operational settings only if approved | No |
| Read audit events | Yes | Narrow operational subset if approved | No |
| Rewrite/delete audit history | No normal user | No | No |
| Manage reservations | Yes | Yes if feature is approved | Create/view own only if enabled |

The matrix is a policy baseline. Each route, server action, RPC, and database policy must implement the same resource-level decision; hiding controls in the frontend is not authorization.

## Server and database boundaries

- Every mutation authenticates the actor, loads authoritative role/profile state, validates ownership and lifecycle state, and performs the operation atomically.
- Tables in an exposed Supabase schema require RLS. Policies must express actual role and ownership rules, not merely `authenticated` access.
- Future RLS should use trusted role assignments, not user-editable metadata. UPDATE policies require both row visibility and new-row checks.
- Loan issue/return/renew, fine adjustments, role changes, settings changes, and archive/withdraw actions should be trusted server-side operations with narrow inputs.
- Privileged Supabase secret/service-role credentials remain server-only. No privileged value may use a `NEXT_PUBLIC_` name or enter browser bundles, logs, PRs, or Preview client code.
- Public catalogue reads may expose only deliberately approved bibliographic and availability fields. Member names, contact fields, loan history, fines, audit data, and settings are not public catalogue data.
- Views used for exposed data must preserve RLS semantics or live in a protected schema with explicit grants; do not assume a view is automatically safe.

## Likely RLS boundary by entity

- `books`, approved catalogue reference data, and carefully limited copy availability: authenticated or approved public read; operator-only writes.
- `book_copies`, `members`, `student_enrollments`, `loans`, `loan_renewals`, `fines`, and `library_settings`: operator-only by default.
- `profiles`, `profile_roles`, and role administration: administrator-only, with a narrowly defined self-read path if needed.
- `audit_events`: administrator read; no normal-user update/delete; inserts occur through trusted operations.
- Future member access: rows must be restricted to the linked member/profile, with no inference from a client-supplied member ID.

## Security invariants

1. No request can grant or assume a role from browser input.
2. A member can never read another member’s PII, loans, fines, or history.
3. A copy cannot be issued twice concurrently.
4. A user cannot alter the actor, timestamps, target, or amount of a privileged mutation by changing client payload fields.
5. A returned loan cannot be reopened; later borrowing is a new loan.
6. Archiving an entity never removes historical circulation or audit records.
7. Every sensitive mutation has an attributable actor and audit event where the operation succeeds.
8. Service-role/secret keys never cross the server/browser boundary.
9. Preview and Development never connect to the Production school database.
10. Real student/member data is never used as Preview seed data or committed to Git.

## Privacy and data classification

| Class | Examples | Default access |
| --- | --- | --- |
| Public catalogue | Title, author, publisher, category, language, non-sensitive availability | Approved catalogue readers |
| Operational | Accession, shelf, copy condition, loan dates, circulation notes | Librarian/admin |
| Personal | Member identifier, name, minimal contact, enrollment | Librarian/admin; own record only if self-service exists |
| Administrative/security | Auth linkage, roles, audit metadata, settings, privileged operational context | Administrator; narrow operator access |

Collect only what the library genuinely needs. Do not add Aadhaar, passwords, unnecessary addresses, private contact details, or student information unrelated to lending and school administration.

## Audit model

Record successful important mutations: catalogue edits/archive, copy creation/withdrawal, member changes, issue, return, renewal, fine adjustment, role changes, and policy/settings changes. Each event should include actor profile ID, action, target entity/type and ID, event timestamp, and minimal structured metadata. Before/after values may be captured for administrative changes after a privacy review. Never log passwords, tokens, full secrets, or unnecessary student data. Normal users cannot update or delete audit events.

## Preview/Production isolation

Vercel Preview deployments must use a separate Development Supabase project and separate environment values. Production values are configured only in the Production environment and are never copied into `.env.local`, Preview, GitHub Actions logs, or documentation. A deployment check must fail closed if the intended environment is missing or mismatched. No Supabase project or environment value is created by this architecture task.

## Deferred member self-service

The initial release can be operator-only. If member access is later approved, expose only catalogue search, own active loans/history, and explicitly approved reservation actions. Resolve the member linkage from the authenticated profile on the server; never trust a member ID from the URL or form as the authorization boundary.

## Human approval required before implementation

The school must approve role ownership, member PII fields, class/session conventions, fine policy and currency, loan/renewal limits, and whether student self-service is in scope. These decisions affect RLS and historical data semantics and should not be silently guessed in migrations.

