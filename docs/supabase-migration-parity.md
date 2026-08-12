# Supabase migration parity

- Canonical Production project ref: `jyvvxseeytjyhuinyzgn`.
- Local migration files after this closeout: 40. The hosted ledger had 40 entries before the compensating migration.
- Several older semantic migrations have different hosted recording timestamps from their repository filenames. These are historical ledger metadata differences, not missing schema, and are retained unchanged.

## Interrupted closeout record

`20260812070846_finalize_room_local_backend` was recorded during an interrupted closeout. The audit RPC correction was completed separately. Its intended workspace RPC correction is superseded by the later forward-only `20260812081232_finalize_operator_workspace_room_local` migration. The historical entry is retained unchanged for auditability.

No historical Production migration was rewritten, renamed, deleted, reverted, or repaired. The compensating migration contains the complete current effective `public.operator_workspace_data` definition with room-local presentation and reporting boundaries, so the desired effective function definition is represented in Git.
