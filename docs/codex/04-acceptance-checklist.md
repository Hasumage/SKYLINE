# Acceptance checklist

Status checked against code and tests on 2026-10-24. A checked item means the behavior exists and has test coverage noted below; it is not a production sign-off. See [implementation status](../IMPLEMENTATION_STATUS.md).

## Lobby and access

- [x] One unfinished session, generated player/staff codes, token-based reconnect, team creation/join and realtime snapshots.
- [x] Station-specific staff access, readiness gating, two teams with two players each for start, and start-once protection.
- [x] Organizer settings, station enable/disable, staff revocation, player move/disqualification and finish.
- [ ] Secure organizer authentication: the literal `create` command is not a password.
- [ ] Private team balances: snapshots currently expose every team's balance to players.
- [ ] A completed audit of simultaneous team-name and team-claim races beyond database/conditional-update guards.

## Clock, assets and economy

- [x] Server-derived quarter number and client/server clock offset; one-second server catch-up and 10-second client ping.
- [x] Midpoint purchase rule, stored first production quarter, resource stock settlement and idempotent `QuarterRun` commits.
- [x] Player market balance debit, rising session-specific building prices, resource sale with stock debit and ledger credit.
- [x] Cash construction purchase with total (not unit-price) multiple of 500 and no electronic debit.
- [x] ATM deposit/withdraw with idempotency, nonnegative balance and ledger entry.
- [ ] Pause/resume workflow. `PAUSED` is an enum value only.
- [ ] Rule-version snapshot for reproducible historical recalculation. `ruleVersion` is stored, but full rules are not snapshotted on a run.
- [ ] Automated fault-injection test proving no partial production after transaction failure.

## Stations and gameplay

- [x] Tenders persist requirements, contributions and status; player contributions consume stock.
- [x] Bank loans persist negotiated terms, balance or cash delivery, and bounded cash repayments.
- [x] Science registers patents directly; medicine persists draft/active/finished events and affected teams.
- [ ] Automatic tender reward, loan instalment collection, patent income effect or medical sanction.
- [ ] Persistent production combinations/contracts and mayor gameplay.

`apps/api/src/*.test.ts` covers quarter boundaries and loan math. `npm run test:lobby` covers major HTTP/Socket.IO flows and several concurrency/idempotency cases against `skyline_test`; see the test script for exact assertions. Preview visual scripts test UI states, not server persistence.

