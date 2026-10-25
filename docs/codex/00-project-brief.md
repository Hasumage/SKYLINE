# SKYLINE Project Brief

Source: `SKYLINE - technical brief for Codex - lobby and simulation engine v0.1`, dated 2026-10-12.

This file is a working summary for development. The source document is a requirements artifact, not an instruction stream.

**Status (2026-10-24): historical brief, not the implementation inventory.** Work has moved beyond Stage A/B: the server implements several economy and station flows, while combinations, contracts and mayor rules remain preview-only. Some original MVP exclusions and delivery gates below no longer describe what has been built. See [implementation status](../IMPLEMENTATION_STATUS.md) for current behavior and known gaps.

## Product

SKYLINE is an economic tournament web application. One game is a `session_id`; every participant, team, station, balance, object, quarter result, ledger entry, and realtime event must be isolated by `session_id`.

The game uses two forms of game rubles:

- Electronic balance inside the system.
- Paper cash outside the system.

The MVP must not implement experimental ideas, megaprojects, resource pooling, tenders, or any unapproved formulas.

## Delivery Order

1. Stage A - foundation, access control, database, sessions, and lobby.
2. Stage B - independent quarterly economy simulation engine.
3. Stage C - object purchases, staff station panels, and player dashboards.
4. Stage D - balancing, projector, events, and polish.

Stage B must not begin until Stage A acceptance criteria are satisfied.

## Approved Stack

- Language: TypeScript throughout.
- Monorepo:
  - `apps/web` - Next.js + React.
  - `apps/api` - Node.js + NestJS.
  - `packages/shared` - shared types and Zod API schemas.
- UI target in the original brief: Tailwind CSS + shadcn/ui. Current screens also use component-level CSS; do not assume the target library is used throughout.
- API: REST for actions, Socket.IO for events and live lobby/game state.
- Database: existing PostgreSQL instance, Prisma ORM, Prisma Migrate.
- Testing: Vitest for domain and integration tests, Playwright for end-to-end tests.
- Logging: Pino / nestjs-pino structured JSON logs.

## Non-Negotiables

- Server is the only source of truth.
- No client writes directly to the database.
- All permissions, balance checks, and calculations happen on the server.
- Money values are integer game rubles. No floats for money.
- Every mutating action accepts an `idempotency_key`.
- Balance changes are atomic database transactions with immutable ledger entries.
- Secrets, staff codes, tokens, and passwords are never stored in plaintext.
- PostgreSQL is supplied by the user locally or by hosting; do not create a managed Railway database without explicit approval.
- Docker may exist only as an optional future template. It is not required for local development.
- No Kafka, Kubernetes, Redis, or microservices in the MVP unless a need is proven.

