# Architecture Decisions

This records the original design direction. The current application uses a consolidated `LobbyService` and `LobbyController` for most server mechanics rather than separate NestJS modules for every boundary below. See [implementation status](../IMPLEMENTATION_STATUS.md) before refactoring around this plan.

## Repository Shape

Use npm workspaces:

- `apps/web`
- `apps/api`
- `packages/shared`

The project can move to pnpm later if needed, but npm is available on the current machine and satisfies the brief.

## Backend Boundaries

The intended NestJS module boundaries were:

- `auth/access`
- `sessions/lobby`
- `teams`
- `catalog/objects`
- `economy/simulation`
- `ledger`
- `realtime`
- `game-master`
- `organizer`

API controllers should stay thin. Business rules belong in domain services.

## Persistence

Use Prisma Migrate against PostgreSQL. Development and test databases must be separate via `DATABASE_URL` and `TEST_DATABASE_URL`.

All cross-session reads and writes must be denied in services and backed by indexed `session_id` columns.

## Realtime

The intended Socket.IO event envelope was:

- `session_id`
- monotonic `sequence`
- `timestamp`
- minimal payload

After reconnect, the client receives a server snapshot and then changes. Private team balances must not be broadcast to general channels.

Currently the server emits role-specific `lobby:snapshot` events and `match:started`; snapshots include `sessionId`, `sequence` and `serverTime`. There is no separate minimal-delta event stream. Connected sockets join a session room, but publishing iterates sockets and generates a token-scoped snapshot for each recipient.

**Known gap:** the current snapshot maps every team's `balance` for every role. The original requirement that other teams' balances remain private is not met yet.

## Idempotency

The target was an `idempotency_key` on every mutation. The implemented request field is camelCase `idempotencyKey`. Financial, purchase, resource-sale, tender-contribution, patent-registration and loan mutations use it; administrative settings, staff management and some state transitions do not. Do not assume uniform idempotency across all routes.

High-risk operations must be protected by database uniqueness and transactions:

- session start,
- team create,
- team join,
- quarter close,
- object purchase,
- ledger postings,
- ATM deposit.

## Logging

Use structured JSON logs with:

- `request_id`
- `session_id`
- `actor_id`
- `event_type`
- level: `debug`, `info`, `warn`, `error`

Never log plaintext secrets, tokens, passwords, or unnecessary personal data.

