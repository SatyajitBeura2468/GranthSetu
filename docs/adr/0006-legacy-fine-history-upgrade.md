# ADR 0006: Preserve legacy fine history during the trusted circulation migration

## Status

Accepted for Phase 5 corrective closeout.

## Decision

Historical rows in `fines` that predate the trusted circulation engine are classified as `legacy`. Their original rows and amounts remain unchanged. New automated overdue assessments use `fine_kind = 'overdue'` and the database permits at most one such assessment per loan through a partial unique index.

## Rationale

The previous schema allowed multiple fine rows for one loan and did not record a category. Treating every historical row as an overdue assessment would invent school policy and make a valid upgrade fail when duplicate historical rows exist. Keeping those rows as individually settleable or waivable history preserves both data and uncertainty.

## Consequences

The uniqueness invariant applies only to V3 automated overdue assessment. Legacy rows may remain multiple per loan. Future business workflows must continue to preserve legacy rows rather than merging or deleting them.
