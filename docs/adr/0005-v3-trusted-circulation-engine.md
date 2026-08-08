# ADR 0005: V3 trusted circulation engine

## Status

Accepted for Phase 5 implementation; school policy values remain deferred.

## Decision

Circulation mutations cross a narrow PostgreSQL RPC boundary. The browser and normal authenticated Data API sessions do not receive direct mutation privileges on `loans`, `loan_renewals`, `fines`, or `audit_events`. Issue, return, renewal, overdue assessment, settlement, and waiver each have a separate RPC. Normal circulation uses the logged-in operator's SSR Supabase session, never the service key.

Each RPC derives the actor from `auth.uid()` through the active profile and role chain. Actor IDs, timestamps, due dates, and automatically assessed amounts are server-owned. Every successful mutation requires a UUID request ID, takes a transaction-scoped advisory lock for that request, and records one audit event. Row locks serialize member checkout limits, copies, loans, and fines. Reusing a request for another action fails; retrying the same successful action returns its recorded result.

Issue requires an active member, a current student enrolment when applicable, configured positive loan period and checkout limit, an active copy, an active parent book, and no active loan for that copy. Return closes an active loan without rechecking later member or copy state. Renewal requires an active member/enrolment, active copy/book, configured renewal limit and loan period, and rejects overdue loans until policy approval. Fine assessment runs only after return, is overdue-only, and uses configured grace days and INR daily minor-unit rate. Settlement records money received outside an online gateway. Waiver is administrator-only until school authority approves broader access.

## Consequences

The database remains the trust boundary under retries, stale browser state, role revocation, metadata forgery, and concurrent requests. The Phase 5 calculation counts each commenced 24-hour interval after grace as one fine day; this is explicitly provisional, not an approved OAV Musiguda policy. Phase 6 must approve loan period, checkout and renewal limits, fine rate, grace period, overdue-renewal permission, and librarian waiver authority. The final dashboard, notifications, student self-service, production infrastructure, and legacy migration remain out of scope.
