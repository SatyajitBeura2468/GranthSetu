# GranthSetu V3 functional completion matrix

This document records the functional foundation delivered by the Phase 5 corrective closeout and the trusted operator administration work. Demo rows in `supabase/seed.sql` remain development-only synthetic fixtures; a clean hosted database does not depend on them.

| Capability | Implemented route/API | Trusted database operation | Allowed role | Test coverage | Status | Remaining UI polish |
|---|---|---|---|---|---|---|
| Operator authentication and role state | `/login`, `/operator` | `current_operator_context`, role/profile checks | Administrator, librarian | Auth/RLS and circulation suites | Implemented | Navigation and inline feedback |
| Book catalogue CRUD and lifecycle | `/operator/catalogue`, `/operator/catalogue/[id]` | `catalogue_upsert_book`, `catalogue_set_book_status` | Administrator, librarian | Typecheck/build; DB integration pending local runtime | Implemented | Responsive editor, richer empty states |
| Authors, publishers, categories, subjects | `/operator/catalogue` reference form | `catalogue_upsert_author`, `catalogue_upsert_publisher`, `catalogue_upsert_category`, `catalogue_upsert_subject` | Administrator, librarian | DB integration pending local runtime | Implemented | Better reference pickers and editing affordances |
| Optional cover images | Book forms | `catalogue_set_book_cover`; private `book-covers` bucket | Administrator, librarian through server action | MIME/size/path validation; signed preview and replacement/removal cleanup implemented | Implemented | Visual treatment only |
| Physical inventory and lifecycle | `/operator/inventory`, `/operator/inventory/[id]` | `inventory_upsert_copy`; active-loan guard | Administrator, librarian | DB integration pending local runtime | Implemented | Barcode workflow and mobile table treatment |
| Derived availability | Catalogue/inventory/dashboard/report RPCs | `catalogue_books`, `inventory_copies`, `operator_dashboard` | Operator read | Query-derived, no editable counters | Implemented | Status badges and visual summaries |
| Members and derived borrowing state | `/operator/members`, `/operator/members/[id]` | `member_create_with_enrollment`, `member_update_profile`, `catalogue_members_v71` | Administrator, librarian | Phase 7.1 pgTAP/integration gates | Implemented | Visual history presentation only |
| Student enrollment/class/section/roll machinery | Member editor and `/operator/settings` | `member_set_enrollment_v71`, academic upsert RPCs | Administrator for structure; operator for enrollment | Roll uniqueness and active-enrollment invariants in Phase 7.1 gates | Implemented | Visual history presentation only |
| Policy/settings | `/operator/settings` | `admin_upsert_setting` | Administrator | Safe missing-policy behavior covered by circulation suite | Implemented | Grouped settings UX and policy explanations |
| Issue, return, renew, fines | `/operator/circulation` | Phase 5 RPCs plus Phase 7.1 policy authorization | Administrator, librarian; waivers policy-controlled | Circulation suite plus Phase 7.1 policy/search gates | Implemented | Visual treatment only |
| Global search | `/operator?q=...` | `global_search_v71` | Administrator, librarian | Phase 7.1 search gate | Implemented | Keyboard search and result grouping |
| Reports and CSV export | `/operator/reports`, `/operator/reports/export` | Phase 7.1 filtered report RPCs | Administrator, librarian | Filtered integration/CSV CI gates | Implemented | Charts and print layout |
| Dashboard metrics | `/operator` | `operator_dashboard` | Administrator, librarian | DB integration pending local runtime | Implemented | Metric hierarchy and responsive composition |
| Audit viewer | `/operator/admin/audit` | `admin_audit_events`; append-only audit rows | Administrator | Existing audit authorization coverage; new admin routes pending DB runtime | Implemented | Date/actor filters and detail drawer |
| Legacy fine upgrade | Migration upgrade script | `legacy` rows preserved; partial unique `overdue` index | Database migration | `db:test:legacy-fines-upgrade` | Implemented, not run here | None |

## Honest validation boundary

The Phase 7.1 branch adds CI gates for clean reset, pgTAP, Auth/RLS, circulation, legacy-fine upgrade, Phase 7.1 search/identity/policy integration, database lint, generated public types, lint, typecheck, and production build. In this Windows execution environment, Docker/Podman is unavailable, so those database gates must be verified on the final remote SHA before any visual-phase verdict. No Production database or real school data is in scope.

Until the final CI run is green, the authoritative verdict is `NOT READY FOR VISUAL DESIGN PHASE`. Hosted Development and Vercel preview checks remain release-gate evidence to record separately when authenticated access is available.
