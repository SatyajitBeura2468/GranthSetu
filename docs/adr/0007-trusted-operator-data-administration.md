# ADR 0007: Trusted operator data administration

## Status

Accepted for the V3 functional foundation.

## Decision

Catalogue, inventory, member, enrollment, reference, cover-path, and academic-structure writes cross narrow security-definer RPCs. Authenticated clients retain read-only table policies and do not receive blanket table DML. RPCs derive the actor from the active profile/role chain, validate lifecycle inputs, apply optimistic stale-update checks where records are edited, and append audit events.

## Consequences

The operator UI is intentionally functional and straightforward. A later UI phase can replace its presentation without moving trust boundaries or duplicating derived state.
