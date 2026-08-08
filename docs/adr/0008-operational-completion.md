# ADR 0008: Operational completion read models

## Status

Accepted for the V3 functional foundation.

## Decision

Dashboard metrics, global search, inventory availability, borrowing summaries, reports, CSV export, and the administrator audit viewer read bounded database-derived results. The application never accepts client-calculated availability, borrowing counts, fine totals, due dates, timestamps, or actors as authoritative inputs.

CSV exports escape spreadsheet formula prefixes, contain no secrets, and are available only to authenticated operators. Reports remain bounded for a single-school workload and can receive richer filters in the later UI phase.
