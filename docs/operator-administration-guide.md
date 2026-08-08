# Operator administration guide

Use the authenticated operator workspace to enter real records. The database remains authoritative: operators never edit circulation tables directly, and availability/borrowing counts are derived.

1. An administrator configures policy and academic structure in `/operator/settings`.
2. A librarian adds references and books in `/operator/catalogue`.
3. The librarian adds each physical copy and accession number in `/operator/inventory`.
4. The librarian creates members and assigns current student enrollment in `/operator/members`.
5. Circulation remains under `/operator/circulation`; issue, return, renew, settlement, and administrator-only waiver use the trusted Phase 5 RPC boundary.
6. Use `/operator/reports` and `/operator/admin/audit` for operational review.

Cover files are limited to JPEG, PNG, and WebP, capped at 5 MB, and stored in the private `book-covers` bucket. Only the server action can upload them after operator authorization.
