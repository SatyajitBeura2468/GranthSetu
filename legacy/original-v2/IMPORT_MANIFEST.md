# Original LMS v2 Import Manifest

## Source received

- `script.google.com.har` was supplied at `C:\Users\subha\Downloads\script.google.com.har`.
- The HAR is a recovery artifact and is intentionally not part of the repository.
- The relevant HAR entry is the successful HTML response from the Google Apps Script deployment. Its embedded `userHtml` payload contains the recovered LMS frontend.

## Source preserved

- `legacy/original-v2/OAV_Musiguda_LMS_frontend_recovered.html`
- `legacy/original-v2/SOURCE_INTEGRITY.md`

The preserved HTML is the extracted `userHtml` payload, written without formatting, minification, or source-level edits. Its SHA-256 is recorded in `SOURCE_INTEGRITY.md`.

## Completeness

The supplied `userHtml` appears to be a complete single-file client frontend for the recovered OAV Musiguda LMS Pro v2 interface. It contains the observed markup, styles, and client-side JavaScript modules in one HTML file.

The repository import is nevertheless partial as an Apps Script project because only the client frontend was supplied.

## Referenced by source but not supplied

- Original Google Apps Script `.gs` server-side source files
- The backing Google Sheet and its data
- Any original Apps Script project manifest, triggers, deployment configuration, or server-only assets

The client references Google Apps Script server functions, but no backend has been recreated, stubbed, or inferred by this import.
