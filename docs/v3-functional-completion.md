# GranthSetu V3 functional completion matrix

This matrix describes the final global Library Room architecture. Seed and `DEVROOM` records are explicitly synthetic Development fixtures; public pages never expose borrower, loan, fine, audit, operator, or private cover-path data.

| Capability | Room-aware surface | Authoritative operation | Boundary |
|---|---|---|---|
| Room discovery and creation | `/`, `/create-library` | `public_resolve_library`, `create_library_room` | Code is a locator; creation requires an authenticated active profile |
| Operator context and switching | `/operator/[libraryCode]` | `operator_accessible_libraries`, `operator_context_for_library` | Active room assignment required on every request |
| Catalogue and covers | `/operator/[libraryCode]/catalogue/*` | canonical catalogue RPCs through `operator_workspace_mutation` | Room-composite references; private cover bucket; signed public proxy |
| Inventory | `/operator/[libraryCode]/inventory/*` | `inventory_upsert_copy` through the room adapter | Accession and barcode are room-local; active-loan rules preserved |
| Members and enrollment | `/operator/[libraryCode]/members/*` | Phase 7.1 member/enrollment RPCs | Stable generated identifier; student enrollment is atomic and historical |
| Circulation and fines | `/operator/[libraryCode]/circulation` | canonical Phase 5–7.1 circulation/fine RPCs | Server-backed full-room search; transactional business rules and idempotency |
| Settings and academics | `/operator/[libraryCode]/settings` | typed settings/session/grade/section RPCs | Administrator only; money uses integer minor units end to end |
| Reports and CSV | `/operator/[libraryCode]/reports` | `operator_room_report` | Identical room-scoped filters drive HTML and CSV |
| Operators | `/operator/[libraryCode]/admin/operators` | invitation plus room assignment/status RPCs | No raw UUID workflow; tenant admin cannot change global profile lifecycle |
| Audit | `/operator/[libraryCode]/admin/audit` | `operator_room_audit` | Administrator only; room/date/action/actor filters are server enforced |
| Public catalogue | `/l/[libraryCode]/*` | narrow paged catalogue/detail/new-title RPCs | Active rooms only; derived availability; no private identities or paths |

## Isolation and policy decisions

- `library_id` is non-null across all tenant-owned tables and participates in composite foreign keys.
- Natural identifiers and barcodes are unique per Library Room, not globally.
- Direct authenticated mutations and all anonymous table access are revoked.
- SECURITY DEFINER execution is denied by default, followed by explicit grants only for current application entry points; the room adapter invokes canonical mutations internally.
- Room-role status is independent of the global profile lifecycle. Shared profiles may serve multiple rooms safely.
- Every room receives a complete typed settings bootstrap; fines, overdue renewal, and librarian waiver start disabled.
- The room mutation adapter delegates to the canonical engine. There is no second, weaker circulation implementation.

## Validation boundary

On 2026-08-09 the complete migration sequence was applied to hosted Development project `granthsetu-dev` (`jyvvxseeytjyhuinyzgn`) only. Five pgTAP suites passed there, generated TypeScript types were refreshed from that schema, and a second synthetic room proved public catalogue separation and multi-room operator discovery. Production was not touched. The exact branch SHA, GitHub Actions run, and Vercel Preview remain the authoritative release evidence recorded at handoff.
