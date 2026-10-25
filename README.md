# SKYLINE

Economic tournament app: Next.js/React frontend, NestJS API, Socket.IO and PostgreSQL with Prisma. The API is the source of truth for the live match. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for what is operational and what remains a preview.

## Local development

1. Run `npm install`, copy `.env.example` to `.env`, and configure the local PostgreSQL connection and secrets.
2. Start PostgreSQL and run `npm run db:status`; apply pending migrations with `npx prisma migrate deploy`.
3. Run `npm run dev` from the repository root. Open `http://127.0.0.1:8080/admin/login`.

The gateway uses port 8080 and forwards web requests to Next.js on 3000 and `/api/*` and `/socket.io/*` to NestJS on 3001. If another service (for example OpenServer/Apache) owns 8080, use this PowerShell command instead:

```powershell
$env:SKYLINE_PROXY_PORT = '8081'
npm run dev
```

Then use `http://127.0.0.1:8081`. Stop the old SKYLINE stack before starting another one: ports 3000 and 3001 cannot be shared. The proxy-port override is for local development; the ngrok scripts still target 8080. See [mobile testing](docs/MOBILE_TESTING.md).

On 2026-10-24, the installed Next.js version emitted a security warning and stopped the first `dev`/`build` attempt; retrying the same command continued. Treat this as an upgrade task before exposing the app publicly, not as a successful security check.

Enter the exact command `create` at `/admin/login` to create the one permitted unfinished session. The organizer receives a five-digit player code and six-character staff codes at `/admin/lobby`. Players join via `/interfaces/lobby/entry`; staff log in at `/admin/login`. Keep `SESSION_SECRET` and `PLAYER_JOIN_CODE_PEPPER` stable while a session exists. `create` is a command, not secure organizer authentication; use a trusted test environment.

## Live game and previews

The live player route is `/interfaces/lobby/game`. It uses authenticated snapshots and server APIs for assets, market purchases, resource sales and tender contributions. The separate `/interfaces/player` page is a local UI preview, including its Production/Combinations and Contracts views; its actions do not persist to the match. The station previews under `/interfaces/*` can show sample data without staff access and switch to server data after login. The mayor screen remains a prototype.

The organizer opens `/admin/projector` from the lobby. It selects a city, resource or team view and opens a read-only display at `/projector?key=...`. A separate six-character projector code appears in the organizer's access-code list; entering it at `/projector` opens the same display. Selection and automatic mode are stored per session. Displays synchronize the selected view from the server every second; automatic mode advances every 15 seconds. Chart data is fetched at most every 10 seconds and is re-rendered only when the returned data changes. Treat the display link and code as read-only access credentials and share them only with testers.

The server implements synchronized session and quarter timing, half-quarter building production, stock, electronic balances and ledger entries, ATM transactions, cash construction records, market purchases/sales, tenders, bank loans, patent registration and medical-event state. Not every stored record has a gameplay effect yet. See [implementation status](docs/IMPLEMENTATION_STATUS.md), [assets and production](docs/GAMEPLAY_ASSETS.md), and [science](docs/SCIENCE_PATENTS.md) before adding rules.

Final standings are persisted once, alongside a per-team score snapshot at match start and each settled quarter. Players, staff and the organizer receive the same saved `results` and `resultHistory` after finish. See [match results](docs/MATCH_RESULTS.md).

## Checks

- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`
- `npm run test:lobby` for the API/Socket.IO integration flow against the separate `skyline_test` database; it migrates that database and leaves finished test sessions.
- `node --env-file=.env scripts/run-player-visual-test.mjs` for the live player visual flow with the test API/proxy on ports 3101/8081; it expects the web dev server on 3000.
- `node scripts/visual-check-player-preview.mjs` for the separate UI preview; it expects the development gateway on 8080.

Use only test database credentials for `npm run test:lobby`; do not point it at live game data. Browser device access is stored locally, so clearing storage can affect reconnection and device-based disqualification.
