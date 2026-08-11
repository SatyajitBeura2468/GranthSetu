# ADR 0011: Global commercial launch hardening

- Status: Accepted
- Date: 2026-08-11

## Decision

Each Library Room owns a `currency_code`, `locale_code`, and `time_zone`. Existing rooms retain `INR`, `en-IN`, and `Asia/Kolkata`; stored money is never converted. Amounts remain integer minor units. The UI derives input precision from `Intl.NumberFormat`: USD has two minor digits, JPY has none, and BHD has three.

Fines capture the room currency at assessment time and reports/export rows contain both `amount_minor` and `currency_code`. A room currency change is allowed only when no fine exists, every replacement cost is null or zero, and every money setting is zero. The update also retags zero-valued money settings atomically. Otherwise `GS_CURRENCY_LOCKED` prevents change.

UTC `timestamptz` remains canonical. The room timezone determines local business dates, local-midnight UTC report bounds, overdue calculations, and presentation. SQL `date` values are rendered as date-only values rather than parsed as browser-local timestamps.

Important workspace mutations require one stable client logical-request UUID. The trusted gateway authenticates and authorizes the actor, locks a hash of the UUID for the transaction, rejects cross-actor/room/operation reuse with `GS_REQUEST_ID_REUSED`, and stores/replays the canonical JSON result in `workspace_mutation_receipts`. The receipt table has RLS and no browser table privileges.

The hosted release runs Node 24 and Vercel `bom1`. CSP omits `unsafe-eval`, `X-Powered-By` is disabled, and CI includes validate, reset-schema database integration, and production-server Playwright E2E gates.

## Consequences

- Historical currency remains legible after later localization changes.
- Retried mutations are correct independently of pending-button UX.
- Indexed UTC report ranges remain performant and room-correct.
- Hosted migrations and production email delivery remain separate provider-verification gates; no SQL migration emulates hosted password-leak protection or SMTP delivery.
