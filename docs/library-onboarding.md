# Library Room onboarding

## Create a room

1. Open `/create-library` and enter the library name, public code, creator name, email, operating currency, display locale, and IANA timezone.
2. The code is normalized to uppercase and must be 5–16 letters, digits, or single hyphens. Reserved platform words are rejected.
3. Confirm the email through Supabase Auth when email confirmation is enabled.
4. GranthSetu creates the room and assigns the creator as its first administrator in one trusted database operation.
5. Open `/l/CODE` to verify the public identity, then `/l/CODE/login` to enter the workspace.

## Configure safely

- Currency is explicitly chosen; it is never inferred from locale or timezone. Existing money is stored as integer minor units and is never converted by an FX operation.
- Administrators may change currency only while there are no fines, no non-zero replacement costs, and no non-zero money settings. Locale and timezone stay independently editable.
- The room timezone defines business dates, report boundaries, due-date presentation, and date-only rendering. Stored timestamps remain UTC instants.
- Review loan period, checkout limit, renewal limit, and fine settings before circulation.
- Add only synthetic test members/books first.
- Invite an existing authenticated user from **Administration → Operators** and assign librarian or administrator deliberately.
- Confirm a librarian cannot open settings, operator management, or audit pages.
- Confirm a user assigned to another room cannot read or mutate this room, even by editing URLs or request payloads.

## Publish the code

The code is safe to put on a poster or school website because it locates only the public catalogue. It does not authenticate staff or reveal member, circulation, financial, operator, audit, or private-storage data.

## Offboarding

Deactivate operator access before staff departure and review the audit log. Do not delete historical loans or audit records to hide prior activity. Archive a room only through an approved operational process with a recoverable export and retention decision.
