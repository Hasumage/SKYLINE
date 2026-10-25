# Database contract

This was the early schema contract. The authoritative current schema is `prisma/schema.prisma`; migrations add gameplay tables and per-session prices. See [implementation status](../IMPLEMENTATION_STATUS.md).

## Stage A Core

- `game_sessions`
- `join_credentials`
- `participants`
- `teams`
- `staff_sessions`
- `station_readiness`
- `session_config` or versioned organization settings
- `audit_events`

## Economy Tables Added After Stage A

- `object_types`
- `owned_objects`
- `resource_types`
- `price_rules`
- `quarter_runs`
- `production_lines`
- `ledger_entries`

The current schema also includes `object_yields`, `resource_stocks`, `object_prices`, `resource_prices`, `resource_sales`, `loans`/`loan_payments`, `tenders`/requirements/contributions, `patents`, `medical_events`/affected teams and `audit_events`. Base building/resource prices live in catalog types; current prices live in session-specific rows. This is implemented storage, not just scaffolding.

## Required Constraints

- Team names are unique inside one session.
- A participant has one nullable `team_id`; team claims are guarded by conditional updates. Device identity and session token hashes are unique.
- Economy tables are linked to `session_id`.
- Add indexes on `session_id` and `team_id`.
- Add positive checks for quantities and prices where Prisma/PostgreSQL migrations allow it.
- `quarter_runs` has unique `(session_id, quarter_number)`.
- Ledger idempotency should prevent duplicate balance postings.

## Money

Use integer game rubles. Do not use floats for balances, prices, revenue, or ledger amounts.

