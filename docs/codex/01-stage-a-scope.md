# Stage A Scope

This is the original Stage A scope, not a list of current limitations. Lobby and access are implemented; quarterly production and several station APIs were added later. See [implementation status](../IMPLEMENTATION_STATUS.md) and the [acceptance checklist](04-acceptance-checklist.md).

Stage A was scoped to the lobby and access foundation.

## Build Now

- Organizer-protected session creation.
- Session configuration:
  - title,
  - expected participant count,
  - enabled station set,
  - required flag per enabled station,
  - quarter duration, default configurable in the 5-7 minute range,
  - minimum team and participant thresholds.
- Cryptographically random player join code.
- Independent station credentials for enabled staff stations.
- Hashed credential storage, revocation, expiry, usage limits, and regeneration path.
- Single public entry URL.
- Player flow:
  - enter session code,
  - create a team with a unique name inside the session,
  - or join an existing team from a list,
  - enter team lobby,
  - reconnect without duplicate team/member creation.
- Staff flow:
  - compact staff login,
  - station-specific session,
  - access only to the permitted station route.
- Organizer lobby:
  - teams and participant counts,
  - enabled station readiness,
  - required station readiness,
  - session status,
  - start button.
- Atomic session start: `WAITING -> ACTIVE`, set `started_at`, set `current_quarter = 1`.
- Realtime lobby updates through Socket.IO.
- Server snapshot after reconnect.

## Originally Deferred Beyond Stage A

- Quarterly economy calculation.
- Object purchases and marketplaces.
- Loans and amortization.
- ATM deposits beyond Stage A scaffolding.
- Patent effects.
- Medicine penalties.
- Events.
- Tenders.
- Megaprojects.
- Experimental mechanics.
- Fake market deficits, surpluses, or unapproved formulas.

## Roles

- `ORGANIZER` - can create and manage sessions and status.
- `GAME_MASTER` - has `station_type` and only station-specific permissions.
- `PLAYER` - belongs to at most one active team in a session.
- `PUBLIC_DISPLAY` - public read-only access.

## Session Statuses

- `DRAFT`
- `WAITING`
- `ACTIVE`
- `PAUSED`
- `FINISHED`

Only the organizer may change status. Every status change must be audited.

