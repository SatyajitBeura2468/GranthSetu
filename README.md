# GranthSetu

GranthSetu is the evolving library management platform for OAV Musiguda.

## Current Repository Stage

This repository currently preserves the original OAV Musiguda LMS Pro v2 implementation as a historical development baseline.

No architectural redesign has yet been applied to the preserved source.

The untouched source is stored under:

    legacy/original-v2/

Future GranthSetu development will be performed separately so the original implementation remains permanently recoverable.

## Current LMS

The supplied frontend includes functionality relating to:

- dashboard statistics and recent activity
- book inventory
- member management
- book issue transactions
- book returns
- circulation records
- reporting and analytics
- global search
- application settings

The preserved implementation is a Google Apps Script HTML frontend. Its server-side Apps Script project files were not supplied with this import.

## Technology

The observed source uses:

- HTML
- CSS
- JavaScript
- Google Apps Script frontend integration through `google.script.run`
- Google Material Icons loaded from Google Fonts

No new framework, backend, database, or application architecture has been added.

## Status

Historical baseline imported.

Modernisation and GranthSetu V3 development have not yet begun.

See [the current system baseline](docs/current-system-baseline.md) and [the import manifest](legacy/original-v2/IMPORT_MANIFEST.md) for scope and provenance.
