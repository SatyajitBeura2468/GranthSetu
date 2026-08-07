# ADR 0002: GranthSetu V3 Domain and Security Model

## Status

Proposed for review. This ADR records the architecture phase only; it does not authorize database provisioning or implementation.

## Context

The preserved V2 client is a monolithic Google Apps Script HTML application. It supports catalogue-like book records, aggregate copies, members, issue/return flows, reports, fines, search, and settings, but the original `.gs` backend and authoritative data export are unavailable. V2 also exposes ambiguous statuses, mixed currency labels, and no demonstrated separation between titles and physical copies.

## Decision

GranthSetu V3 will use a normalized PostgreSQL-oriented domain model with independent profiles, library members, academic enrollments, bibliographic books, physical book copies, loans, renewal events, optional normalized fines, settings, and append-only audit events. Authentication identity remains distinct from library membership. Initial authorization roles are administrator and librarian; member self-service is deferred.

Availability is derived from copy operational state and the absence of an active loan. Overdue is derived from due time. Historical records are retained through archival/inactive semantics, not destructive cascades. Future Supabase RLS and trusted server operations enforce the authorization matrix.

## Rationale

Separating title from copy supports multiple owned copies, unique accession numbers, accurate inventory, and circulation history. Academic enrollment history preserves class-wise reporting across promotion. Independent members and profiles support students without accounts and staff with operator accounts. Event history and database constraints protect auditability and prevent duplicated or drifting state.

## Alternatives considered

- Copy the V2 book/member/transaction shape: rejected because it conflates titles and inventory and relies on weak free-text states.
- Use authentication accounts as members: rejected because borrowing eligibility does not require an online login.
- Store mutable availability counters: rejected because counters can drift from loans and copy condition.
- Add reservations, payments, stocktakes, and multi-school tenancy immediately: deferred because current evidence does not justify the complexity.
- Introduce microservices, search infrastructure, CQRS, or an analytics database: rejected for a single-school initial scale.

## Consequences

The model requires more explicit records and migration mapping than V2, but supports reliable history, constraints, reports, and future extensions. Fine and self-service policies need explicit school approval. A later implementation must design schema migrations, authentication, trusted mutation paths, and RLS together; frontend controls alone are insufficient.

## Scope boundaries

This ADR does not create a Supabase project, configure environment variables, create tables or executable migrations, implement auth/RLS, import data, change the V2 copy, or deploy production functionality.

## Deferred decisions

Approve the grade/session vocabulary, member PII minimum, fine/settlement policy, loan and renewal limits, reservation/self-service scope, and any dedicated acquisition, stocktake, or loss/damage workflows before migrations begin.

