# GranthSetu V3 functional completion matrix

This document records the functional foundation delivered by the Phase 5 corrective closeout and the trusted operator administration work. Demo rows in `supabase/seed.sql` remain development-only synthetic fixtures; a clean hosted database does not depend on them.

| Capability | Implemented route/API | Trusted database operation | Allowed role | Test coverage | Status | Remaining UI polish |
|---|---|---|---|---|---|---|
| Operator authentication and role state | `/login`, `/operator` | `current_operator_context`, role/profile checks | Administrator, librarian | Auth/RLS and circulation suites | Implemented | Navigation and inline feedback |
| Book catalogue CRUD and lifecycle | `/operator/catalogue`, `/operator/catalogue/[id]` | `catalogue_upsert_book`, `catalogue_set_book_status` | Administrator, librarian | Typecheck/build; DB integration pending local runtime | Implemented | Responsive editor, richer empty states |
| Authors, publishers, categories, subjects | `/operator/catalogue` reference form | `catalogue_upsert_author`, `catalogue_upsert_publisher`, `catalogue_upsert_category`, `catalogue_upsert_subject` | Administrator, librarian | DB integration pending local runtime | Implemented | Better reference pickers and editing affordances |
| Optional cover images | Book forms | `catalogue_set_book_cover`; private `book-covers` bucket | Administrator, librarian through server action | MIME/size/path validation in action; storage integration pending local runtime | Implemented | Signed-cover preview and replacement cleanup |
| Physical inventory and lifecycle | `/operator/inventory`, `/operator/inventory/[id]` | `inventory_upsert_copy`; active-loan guard | Administrator, librarian | DB integration pending local runtime | Implemented | Barcode workflow and mobile table treatment |
| Derived availability | Catalogue/inventory/dashboard/report RPCs | `catalogue_books`, `inventory_copies`, `operator_dashboard` | Operator read | Query-derived, no editable counters | Implemented | Status badges and visual summaries |
| Members and derived borrowing state | `/operator/members`, `/operator/members/[id]` | `member_upsert`, `catalogue_members` | Administrator, librarian | DB integration pending local runtime | Implemented | Inline validation and enrollment editor polish |
| Student enrollment/class/section/roll machinery | Member editor and `/operator/settings` | `member_set_enrollment`, academic upsert RPCs | Administrator for structure; operator for enrollment | DB integration pending local runtime | Implemented | Better academic selectors and history view |
| Policy/settings | `/operator/settings` | `admin_upsert_setting` | Administrator | Safe missing-policy behavior covered by circulation suite | Implemented | Grouped settings UX and policy explanations |
| Issue, return, renew, fines | `/operator/circulation` | Phase 5 trusted circulation RPCs | Administrator, librarian; waiver administrator-only | Existing circulation integration suite | Implemented | Search-first circulation workflow |
| Global search | `/operator?q=...` | `global_search` | Administrator, librarian | DB integration pending local runtime | Implemented | Keyboard search and result grouping |
| Reports and CSV export | `/operator/reports`, `/operator/reports/export` | `report_circulation`, `report_overdue`, `report_popular_books`, `report_member_activity`, `report_inventory`, `report_fines` | Administrator, librarian | CSV formula-injection guard in route; DB integration pending local runtime | Implemented | Filters, charts, print layout |
| Dashboard metrics | `/operator` | `operator_dashboard` | Administrator, librarian | DB integration pending local runtime | Implemented | Metric hierarchy and responsive composition |
| Audit viewer | `/operator/admin/audit` | `admin_audit_events`; append-only audit rows | Administrator | Existing audit authorization coverage; new admin routes pending DB runtime | Implemented | Date/actor filters and detail drawer |
| Legacy fine upgrade | Migration upgrade script | `legacy` rows preserved; partial unique `overdue` index | Database migration | `db:test:legacy-fines-upgrade` | Implemented, not run here | None |

## Honest validation boundary

Application lint, TypeScript, and production build run without errors in this checkout. Database reset, pgTAP, integration, generated-type regeneration, database lint, and the legacy upgrade script require Docker/Podman and a local PostgreSQL runtime, which were unavailable in the execution environment. Hosted Development verification was not performed because authenticated Supabase management access was unavailable.

The remaining work for the next UI phase is presentation quality, not the core operator workflows listed above. Production deployment, real school data import, and deferred product features remain separately scoped.
