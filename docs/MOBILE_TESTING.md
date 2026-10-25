# Mobile testing via ngrok

This is a development-only public HTTPS endpoint. It forwards to the existing local gateway at `127.0.0.1:8080`; no database port or second API tunnel is opened.

| Public path | Local service |
| --- | --- |
| `/`, `/interfaces/*`, `/_next/*` | Next.js on port 3000 |
| `/api/*` | NestJS on port 3001 |
| `/socket.io/*` | Socket.IO on port 3001, including WebSocket upgrades |

## One-time setup on Windows

1. Install [ngrok](https://ngrok.com/download/windows): `winget install ngrok -s msstore`.
2. Create an ngrok account, verify its email address, and run `ngrok config add-authtoken <TOKEN>` in your own terminal. Never put the token in this repository or share it in chat.
3. Start local PostgreSQL. Set `DATABASE_URL` in `.env` and run `npm run db:status`.

The ngrok auth token belongs in the user's ngrok configuration, not in this repository.

## Start and check

From the repository root run `npm run dev:tunnel`. This builds the web app and starts its production server, the API, gateway and ngrok, then prints `SKYLINE public URL: https://...`. Keep that terminal open. Press Ctrl+C to stop the stack. Ports 3000, 3001 and 8080 must be free; stop another SKYLINE stack first. OpenServer/Apache can also occupy 8080. Set `SKYLINE_PROXY_PORT` before launching to use a different gateway/tunnel port; the tunnel checker respects it too. If 3000 is also occupied, start a production web server on another port and point `SKYLINE_WEB_PORT` in the gateway to it. This mode has no Next.js HMR; use `npm run dev` for local editing.

The URL also appears at the local ngrok inspector, `http://127.0.0.1:4040`. It may be assigned to the ngrok account rather than changing on every restart. No public URL is hard-coded in the app.

Run `npm run tunnel:check` for the local gateway, then `npm run tunnel:check -- https://YOUR-NGROK-HOST` for the public page, a browser JavaScript asset, `/api/health` and the unauthenticated Engine.IO WebSocket transport. Authenticated Socket.IO lobby events are covered by `npm run test:lobby` against the separate test database. The public check sends ngrok's browser-warning bypass header for automated HTTP requests. A new browser, including a phone browser, may first show the ngrok Free warning (`ERR_NGROK_6024`); tap **Visit Site** to continue. Do not enter the lobby code on that warning page. An ngrok URL alone does not prove the tunnel works: both checks must pass.

If ngrok cannot authenticate, visit the account settings shown in its error. If it reports `ERR_NGROK_334`, stop the older ngrok agent before restarting; do not run two agents for the same endpoint. If the public check returns 502, confirm the three local ports and rerun the local check. Do not disable API auth or use `CORS: *` to hide a routing error.

## Phone checklist

1. Turn Wi-Fi off on the phone and open the printed HTTPS URL over mobile data.
2. Open `/interfaces`, the lobby screens and ATM. Confirm assets load and there are no 404s, mixed-content requests or JavaScript errors.
3. Check `/api/health` and the Socket.IO connection; inspect browser requests to ensure none point to `localhost` or port 3001.
4. Retry after refreshing and after restarting the tunnel; use the currently printed URL.
5. Check for 502, 429, authorization errors and redirect loops.

For projector testing, open `/projector` on the display device and enter the six-character code shown in the organizer's `Codes of access` section. The organizer selects the visible screen at `/admin/projector`; the display itself has no graph controls. The same public hostname must be used for both windows.

If the page renders but buttons or fields do not respond, verify that `npm run dev:tunnel` is running, not just `npm run dev`, and rerun the public check. Next.js development mode can reject browser scripts requested through the public origin; tunnel mode serves the built web app instead.

The repository now has PostgreSQL-backed lobby/team access, Socket.IO snapshots and server-backed player assets, market and tenders. A successful connectivity check still does **not** validate a full match or the preview-only production combinations/contracts. Use `npm run test:lobby` against the test database for backend flows, then exercise authenticated devices on the public URL. See [implementation status](IMPLEMENTATION_STATUS.md).

ngrok Free can impose request/bandwidth limits and a browser warning. This setup is not a load test or production deployment. Prototype pages and the `create` session command are reachable from the public URL even though gameplay actions require tokens; use only a trusted test session and do not put private data in it. A physical phone test is separate from automated checks and has not been performed here.
