# GranthSetu V3 Data Migration Plan

This is a plan only. The authoritative Google Sheet/export has not been supplied, and no production data has been accessed or imported.

## Controlled migration sequence

1. Obtain/export the authoritative Google Sheet.
2. Preserve an untouched archival export and record its checksum.
3. Inspect all sheets, columns, formats, and formulas.
4. Identify stable IDs, duplicates, missing references, and orphaned rows.
5. Map verified source fields to the approved V3 schema.
6. Normalize dates, statuses, fine values, and other agreed representations.
7. Validate member, book, copy, and transaction references.
8. Run a dry-run import into the isolated development Supabase project.
9. Generate migration diagnostics and an exception report.
10. Compare source and target row counts and transaction counts.
11. Resolve anomalies through reviewed, traceable decisions.
12. Back up production before any approved production migration.
13. Import through a reviewed, repeatable migration process.
14. Verify checksums, counts, references, and representative records.
15. Keep a tested rollback path and preserve the source archive.

## Known V2 migration risks

The V2 baseline records observed concerns including transaction-status inconsistency, mixed currency labels, and a client/runtime dependency on Google Apps Script. These are migration risks to investigate against the authoritative export, not assumptions to resolve by guessing.

No domain tables, data rows, seeds, or migration SQL are created in this foundation phase.
