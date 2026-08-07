# Trusted circulation engine

Phase 5 provides an operator-only engineering workbench at `/operator/circulation`. It is deliberately smaller than the future product UI.

## Operations

- **Issue** locks the member and copy, checks active membership, current student enrolment, policy settings, copy/book state, checkout limit, and the active-copy invariant, then inserts a server-timestamped active loan and `circulation.loan_issued` audit event.
- **Return** locks an active loan, records server time and the authoritative operator, and emits `circulation.loan_returned`. It does not automatically assess a fine and does not block on later member or copy state.
- **Renew** locks the loan, rejects returned or overdue loans, checks current member/enrolment and copy/book state, enforces `renewal_limit`, appends `loan_renewals`, updates `due_at`, and emits `circulation.loan_renewed`.
- **Assess overdue fine** operates only on returned loans. When `fines_enabled` is true it requires `grace_period_days` and `daily_fine_rate_minor`, counts commenced 24-hour periods after grace, multiplies integer paise, and creates one `overdue` fine. Missing/disabled policy fails safe; zero produces `no_fine_due`.
- **Settle** records a positive amount actually received outside an online payment gateway. It locks the fine and rejects amounts above `assessed - waived - settled`, then emits `circulation.fine_settled`.
- **Waive** is administrator-only, requires a positive amount and reason, locks the fine, limits the amount to the outstanding balance, and emits `circulation.fine_waived`. Fines are never deleted.

## Settings and errors

Issue requires `default_loan_period_days` and `checkout_limit`. Renewal additionally requires `renewal_limit`. Fine assessment requires enabled `fines_enabled`, `grace_period_days`, and INR `daily_fine_rate_minor`. The repository seed keeps fines disabled and does not assert real school policy. Known domain codes are mapped to operator-safe messages in `src/lib/circulation/errors.ts`; raw SQL errors are not shown.

## Trust, idempotency, and concurrency

RPCs derive actors from the current authenticated profile/roles and use PostgreSQL time. No RPC accepts actor or timestamp fields, and automated assessment accepts no amount. UUID `p_request_id` is the operation key, not an identity. A partial unique audit index, advisory request lock, action comparison, and row locks prevent duplicate side effects and cross-operation reuse. Successful operations have exactly one circulation audit event; failed transactions roll back without a success audit.

Audit actions are `circulation.loan_issued`, `circulation.loan_returned`, `circulation.loan_renewed`, `circulation.fine_assessed`, `circulation.fine_settled`, and `circulation.fine_waived`.

## Local testing

With Docker Desktop or Podman available:

```text
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:test:auth
npm run db:lint
npm run db:types
```

The CI database job runs the same disposable reset path. `scripts/test-circulation.mjs` is the integration-test entry point for synthetic Auth identities and is intentionally never connected to the hosted Development project.

## Deferred

The calculation semantics, school settings, overdue-renewal permission, librarian waiver authority, full UI, notifications, reservations, acquisitions, student self-service, Production, and V2 migration are Phase 6 or later decisions.
