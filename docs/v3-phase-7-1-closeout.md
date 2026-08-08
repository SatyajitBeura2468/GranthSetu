# GranthSetu V3 Phase 7.1 closeout

## Scope

This branch is based on the latest `origin/main` and closes the functional requirements named by the Phase 7.1 prompt before visual redesign. It does not merge into `main`, touch Production, import real school data, or change unrelated repositories.

## Reconciliation

The five commits found only on `origin/feat/v3-operational-completion` were reviewed individually. The safe application fixes for trusted-read failure handling and audit actor/date filtering were cherry-picked onto this branch. The old migration edits and generated-type sync were not replayed as history rewrites; the final database behavior is represented by new forward migrations, and public types must be regenerated from the clean final schema in CI.

## Functional closeout

- `student_enrollments.roll_number` is nullable, normalized, bounded, and control-character safe. Active roll uniqueness is scoped to session + grade + section, while active enrollment is unique per member and completed/withdrawn history remains preserved.
- New trusted member creation generates collision-safe `GS-000001`-style identifiers in the database and creates student enrollment atomically. Profile edits cannot change the identifier.
- Search RPCs cover members, copies, loans, and fines with bounded results and practical fields. Circulation UI is search-first and trusted RPCs remain the final authority.
- Overdue renewal and librarian waiver permissions are explicit typed settings and enforced in database authorization.
- Reports apply filters in the database; CSV export reuses the same arguments and prefixes formula-like cells safely.
- Private cover upload, signed preview, replacement, removal, and orphan cleanup are server-only and constrained to approved image types, size, and stable paths.

## Validation status

Local lint and typecheck pass. Database validation cannot run locally because Docker/Podman is unavailable. The final CI workflow is therefore the completion authority and must be green on the final branch SHA. Until that evidence exists, the verdict remains `NOT READY FOR VISUAL DESIGN PHASE`.
