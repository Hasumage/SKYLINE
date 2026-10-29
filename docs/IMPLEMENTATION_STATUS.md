# Implementation status

Checked against the code on 2026-10-25.

## Entry points and persistence

| Area | Current state |
| --- | --- |
| Organizer lobby and player/staff login | Live API, PostgreSQL and Socket.IO. One unfinished session; player and staff codes; device tokens; teams, station readiness and organizer controls. |
| `/interfaces/lobby/game` | Live player screen. Assets, stock, building market, resource sales and tender contributions use server data. |
| `/interfaces/player` | Independent development preview. Production, combinations and contracts are local React state and do not write to PostgreSQL. |
| `/interfaces/atm`, `/interfaces/bank`, `/interfaces/construction`, `/interfaces/patents`, `/interfaces/medicine`, `/interfaces/tenders-admin` | Have sample-data presentation and authenticated server paths. The API enforces access for real actions. |
| `/interfaces/mayor` | UI prototype; no mayor rules or API. |
| `/admin/projector` and `/projector?key=...` | Live organizer controls and read-only public display. Selection/automatic mode persist in PostgreSQL; charts use actual assets and quarterly production. |

The server isolates gameplay records by `sessionId`; role and station checks are in `LobbyService`. Mutations with financial or stock consequences use database transactions, session row locking and idempotency keys. Audit events record important actions. Access tokens are hashed; join codes are hashed for lookup and encrypted for organizer display. The browser stores its token and device ID in local storage.

## Session clock and quarter settlement

`POST /api/admin/start` changes `WAITING` to `ACTIVE`, records `startsAt` and quarter 1, and creates the first `QuarterRun`. Start requires all enabled stations to be connected and at least two teams with two non-disqualified players each. The organizer can set 10-30 quarters of 5-10 minutes each before start. All stations start enabled and required by default.

The server clock is authoritative. Snapshots include `startsAt`, `serverTime`, `currentQuarter`, duration and a monotonic event sequence. The client recalculates its timer locally, applies a server-time offset, and refines that offset with a Socket.IO ping every 10 seconds. The API checks due sessions about once per second. Completed quarters are settled in order inside a transaction; after restart it catches up missed quarters. The unique `(sessionId, quarterNumber)` run and `COMMITTED` status prevent duplicate production. A session becomes `FINISHED` one hour after the end of the final scheduled quarter, unless the organizer finishes it earlier. `PAUSED` exists in the schema, but there is no pause/resume endpoint or active paused workflow.

The match score is saved at start, after each committed quarter and at finish. Final results and the saved score timeline are served identically to players, staff and the organizer; see [match results](MATCH_RESULTS.md). The history is available for future charts, but the current results UI displays only the final standings. The projector does not yet show final standings.

A building purchased strictly before the midpoint of a quarter first produces at that quarter's end. At or after the midpoint, it starts at the following quarter's end. `firstProductionQuarter` is stored on the purchase. Each eligible batch contributes `quantity * unitsPerQuarter` to the team's resource stock and a `ProductionLine`. Production lines currently record `unitPrice = 0` and `revenue = 0`: production itself does not credit the electronic balance. See [assets and production](GAMEPLAY_ASSETS.md).

## Economy and station actions

The projector has a city-wide building mix, one production-share screen per resource, and a production profile per team. Only the organizer changes its selected screen. A six-character code in the organizer lobby exchanges for a read-only display token; both are stored as encrypted `PUBLIC_DISPLAY` credentials. The display cannot call organizer actions. Automatic mode cycles through the available screens every 15 seconds using a server timestamp, including after reconnects. The display polls selection every second, chart data every 10 seconds and skips an unchanged chart payload. The clock is separate from chart rendering. New team/resource screens enter the cycle when they appear in the database. The projector does not expose electronic balances. There is no projector-specific Socket.IO channel or chart history beyond the most recent five settled quarters.

| Mechanic | Implemented server behavior | Not implemented yet |
| --- | --- | --- |
| Catalog and prices | Six seeded building/resource types. Internal base prices and per-session current prices are separate. Building current price advances by the type's `priceStep` for every unit bought. Players see current prices. | No automatic demand-based resource repricing or price-management UI. |
| Player building market | Player buys 1-20 units during an active quarter. The current price is multiplied by quantity, debited from the electronic balance and recorded in the ledger. | No trading buildings between teams. |
| Construction staff | Staff records 1-1000 buildings at a negotiated positive unit price. The **total** must be divisible by 500. Objects and current catalog price update, but payment is physical cash. | No cash inventory in the app; no electronic balance debit for this path. |
| Production and stock | Quarterly output is persisted in `ProductionLine` and `ResourceStock`; live player assets show both. | No automatic sale or consumption of all production. |
| Resource sale | Player sells units from stock at the current session price. The server rejects stale prices and insufficient stock, then atomically decrements stock and credits the balance/ledger. | No automatic market price movement. |
| ATM | ATM or bank staff deposits/withdraws a positive multiple of 500. Withdrawal cannot overdraw the team. Balance and immutable ledger entry are committed together. | Physical cash is not tracked. |
| Tenders | Organizer or Enterprises staff creates/closes a tender; players contribute required resources during an active quarter before its deadline. Stock decreases; collected totals and completion are persisted. | No automatic prize, payout or bonus when completed. |
| Bank | Bank staff issues one active loan per team. Money can be handed out in cash or credited to balance. The quote uses simple quarterly interest: `round(principal * (1 + quarterlyRate * quarters))`, where `quarterlyRate` is a fraction (for example 0.10 for 10%); displayed payment is `ceil(total / quarters)`. Cash repayments reduce the debt and cannot exceed what remains. | No automatic quarterly debit, overdue logic or cash ledger. |
| Science | Staff registers patents directly for a team (no application queue), up to two active by registered-quarter/duration calculation. | Coefficients do not yet affect earnings; expiry is inferred from quarter, not a settlement action. |
| Medicine | Staff creates a draft, sets title/duration/affected teams, starts and finishes it; state and history persist. | No defined event catalog, sanctions, automatic expiration or production effect. |
| Mayor | Mobile UI for goals, emergencies and decrees. | No backend rules or persistent mayor actions. |
| Combinations/contracts | II/III recipe catalog and solo/team actions in the player preview. | No recipe/contract tables or API; no live resource conversion or inter-team settlement. |

Cash and electronic balance are separate. Only the player market, resource sales, ATM operations and loans delivered **to balance** change electronic balance. Construction purchases, cash loans and cash repayments do not. Prices and money are integer rubles; `base` values are internal and `current` values are returned to players.

## Verification and limits

`npm run test --workspace apps/api` covers quarter boundaries and loan quote math. `npm run test:lobby` exercises lobby, station access, Socket.IO, clock catch-up, construction, ATM, market, stock, tenders, bank, patents, medicine and projector authorization/synchronization against a dedicated test DB. Visual scripts under `scripts/visual-check-*.mjs` exercise the separate interface previews; they do not prove a live match works end to end. Run `npm run typecheck`, `npm run lint` and `npm run build` after changes.

Remaining integration priority: define approved recipes/contracts and persistence, connect them to the live player screen, then add their quarterly settlement and tests. Patent effects, medicine consequences and mayor rules require game-design decisions before implementation. The original scope/architecture files under `docs/codex` are historical planning artifacts; use this document and the code for current behavior.

Operational/security gaps found during this review: the literal organizer `create` command is not authentication; the snapshot currently includes all teams' electronic balances even for a player; and the installed Next.js version reports a security advisory (on 2026-10-24 it required a second `dev`/`build` invocation). Resolve these before public deployment.
