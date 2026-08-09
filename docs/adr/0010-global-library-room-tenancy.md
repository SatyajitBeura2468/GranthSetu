# ADR 0010: Global Library Room tenancy

- Status: Accepted
- Date: 2026-08-09

## Context

The mature GranthSetu circulation model was built for one library. V3 must serve many independently operated libraries while preserving the bootstrap institution and preventing cross-tenant access at every layer.

## Decision

Introduce `libraries` as the tenant root. Assign every existing tenant-owned row to deterministic room `OAVMUSI`. Store non-null `library_id` on role assignments, catalogue, inventory, members, academic structure, circulation, settings, and audit records.

Natural identifiers are unique per library. Every relationship between tenant-owned tables also carries `library_id` and is backed by a composite foreign key. Public room codes are case-normalized locators, not credentials.

Anonymous users receive only narrow security-definer functions for active room identity and safe catalogue availability. Operators authenticate with Supabase Auth and must have a live room-role assignment. Trusted workspace functions resolve the room from its code, verify the assignment/role, set the transaction tenant context, validate referenced records inside the same room, perform the mutation, and append an audit event. Direct writes remain ungranted.

## Consequences

- The platform can reuse codes such as accession and member numbers between rooms safely.
- URL or payload tampering cannot create cross-room foreign-key relationships.
- Existing IDs and history are preserved in `OAVMUSI`.
- Every new tenant-owned table and trusted function must include explicit room isolation.
- A web deployment is not data-plane complete until the migration and isolation suites run against a reviewed database target.

## Rejected alternatives

- Separate database per library: stronger physical isolation but disproportionate operational cost for this stage.
- Client-only room filters: not an authorization boundary.
- Encoding the room in authentication metadata: user-editable or stale claims must not be authoritative.
- Treating the public code as a secret: codes are designed for public discovery.
