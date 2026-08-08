# GranthSetu V3 Phase 7.1 closeout

## Scope

This branch is based on the latest `origin/main` and closes the functional requirements named by the Phase 7.1 prompt before visual redesign. It does not merge into `main`, touch Production, import real school data, or change unrelated repositories.

## Reconciliation

The five commits found only on `origin/feat/v3-operational-completion` were reviewed individually. The safe application fixes for trusted-read failure handling and audit actor/date filtering were cherry-picked onto this branch. The old migration edits and generated-type sync were not replayed as history rewrites; the final database behavior is represented by new forward migrations, and public types must be regenerated from the clean final schema in CI. One unavoidable bootstrap exception repairs the pre-existing `global_search` definition in place: clean reset failed before any forward migration because PostgreSQL rejected its `ORDER BY label` over a union. The same correction is also represented forward in `20260808140000`.

## Functional closeout

- `student_enrollments.roll_number` is nullable, normalized, bounded, and control-character safe. Active roll uniqueness is scoped to session + grade + section, while active enrollment is unique per member and completed/withdrawn history remains preserved.
- New trusted member creation generates collision-safe `GS-000001`-style identifiers in the database and creates student enrollment atomically. Profile edits cannot change the identifier.
- Search RPCs cover members, copies, loans, and fines with bounded results and practical fields. Circulation UI is search-first: the operator must explicitly select one borrower and one available physical copy, and editing either search clears its selection before the issue mutation can submit. Trusted RPCs remain the final authority.
- The Phase 7.1 migration reconciles pre-existing duplicate active enrollments before creating the one-active-enrollment-per-member index. It retains the row with the newest academic session start date, then newest enrollment `created_at`, then greatest stable enrollment ID; every older active row is preserved and marked `completed`.
- Overdue renewal and librarian waiver permissions are explicit typed settings and enforced in database authorization.
- Reports apply filters in the database; CSV export reuses the same arguments and prefixes formula-like cells safely.
- Private cover upload, signed preview, replacement, removal, and orphan cleanup are server-only and constrained to approved image types, size, and stable paths.

## Regression coverage

- `scripts/test-phase71-issue-selection.mjs` covers multiple candidates, exact borrower/copy binding, target search beyond the default result window, unavailable-on-loan copies, concurrent issue serialization, malformed identities, and the UI selection contract.
- `scripts/test-phase71-upgrade.mjs` resets to the pre-Phase-7.1 schema, creates two active enrollments for one member across sessions with grade/section/roll history, applies the Phase 7.1 migrations, and proves deterministic reconciliation, history preservation, and the new invariant.

## Validation status

Local install, lint, typecheck, production build, JavaScript syntax checks, and the explicit-selection UI contract pass. Database validation cannot run locally because Docker/Podman is unavailable. The final CI workflow is therefore the completion authority and must be green on the final branch SHA; the final SHA and run ID are recorded in the handoff and PR checks. Until that evidence exists, the verdict remains `NOT READY FOR VISUAL DESIGN PHASE`.
