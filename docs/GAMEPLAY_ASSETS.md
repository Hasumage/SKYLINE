# Assets, resources and half-quarter production

## Current scope

The server owns asset and stock data. `ObjectType` and `ResourceType` are catalog entries. `ObjectYield` defines units of one resource produced by one building in one quarter. `OwnedObject.quantity` is the number of purchased buildings in a batch, not the number of rows. `ResourceStock` holds the current quantity per session, team, and resource. The player snapshot includes `assets` with quantities and yields, and `resources` with stock quantities; `teams[].assetsCount` sums building quantities. Snapshots are pushed over Socket.IO when a purchase or quarter settlement changes them.

The seeded catalog has six object/resource pairs. Amounts below are **internal base** prices; players see only the current per-session prices. The first building purchase in a session uses the base price, after which the current price increases by `priceStep` for every unit bought through either the player market or Construction.

| Building/resource | Base building price | Price step per building | Units/quarter | Base resource price per unit |
| --- | ---: | ---: | ---: | ---: |
| Housing | 2,000 ₽ | 250 ₽ | 30 | 15 ₽ |
| Energy | 7,000 ₽ | 500 ₽ | 26 | 60 ₽ |
| Gas | 9,000 ₽ | 500 ₽ | 24 | 80 ₽ |
| Metal | 12,000 ₽ | 1,000 ₽ | 18 | 140 ₽ |
| Wood | 4,000 ₽ | 500 ₽ | 42 | 20 ₽ |
| Coal | 10,000 ₽ | 500 ₽ | 35 | 55 ₽ |

`ObjectType.purchaseBasePrice` and `ResourceType.baseUnitPrice` are internal catalog values. `ObjectPrice.currentPrice` and `ResourcePrice.currentUnitPrice` belong to a session and are initialized from them. Building purchases advance the current building price; the server has no automatic resource-price movement yet. `ObjectYield.unitsPerQuarter` and its resource relation define output. Building pictures live under `apps/web/public/generated/building-*.png`. Oil is deliberately absent from the catalog.

The live player page is `/interfaces/lobby/game`: it uses authenticated snapshots and `/api/market/*` for assets, market purchases and stock sales. The separate `/interfaces/player` page is an independent development preview with sample values. In that preview, Assets, Market, Tenders and Production share local state only; its resource prices, building prices and demand labels are illustrative. The Production tab opens a II/III combination catalog by default, with Resources and Contracts beside it. Solo combination actions adjust local preview stock, but there is no combination or contract API/DB mechanic.

The preview Tenders tab uses local sample projects. Separately, the live player page loads server tenders. A live contribution consumes stock in the database, respects the remaining requirement and deadline, and updates collected progress; there is no automatic reward yet.

## Half-quarter rule

`apps/api/src/quarter-timing.ts` is the reusable timing layer. It computes the current quarter and `firstProductionQuarter` from the authoritative server clock, session start, and configured quarter length. A purchase strictly before the midpoint produces at the end of the same quarter. A purchase at or after the midpoint starts producing at the end of the following quarter. For a five-minute quarter, a purchase at 2:29.999 qualifies for that quarter; at 2:30.000 it does not. Purchases outside the scheduled quarters are rejected. The rule is stored on each purchase, so later structures can use the same timing decision without duplicating it.

At quarter end, `apps/api/src/quarter-production.ts` sums `quantity * unitsPerQuarter` for eligible asset batches. It writes a `QuarterRun`, one `ProductionLine` per team/resource, and increases `ResourceStock` in a database transaction. A committed run is not settled again; missed quarters are caught up after an API restart. Production currently creates resource units only (`unitPrice` and `revenue` on its lines are zero); it does not infer sales, consumption or balance changes. Server time, quarter number and snapshots are synchronized as described in [implementation status](IMPLEMENTATION_STATUS.md).

## Purchase API

`POST /api/construction/purchases` requires the Construction structure administrator's bearer token and an active match. Body:

```json
{
  "teamId": "team-id",
  "objectTypeId": "catalog-object-id",
  "quantity": 2,
  "unitPrice": 9250,
  "idempotencyKey": "unique-purchase-request-001"
}
```

Quantity is an integer from 1 to 1000. The negotiated `unitPrice` is a positive integer (at most 1,000,000 ₽) and the **total cash payment** (`quantity * unitPrice`) must be a multiple of 500 ₽; the unit price itself need not be. The example totals 18,500 ₽. The key is 8-128 ASCII letters, digits, underscores or hyphens. Repeating the same request with its key returns the current snapshot without purchasing twice; reusing it for different data fails. Only active catalog objects can be purchased during the active quarter. The purchase persists objects, production timing and a new current catalog price, but does not debit the team's electronic balance. Cash is exchanged outside the electronic ledger.

The player market uses `POST /api/market/purchases` with `objectTypeId`, `quantity` (1-20) and `idempotencyKey`; its total is charged to electronic balance at the current catalog price. `GET /api/market/catalog` returns current building prices and yields. `GET /api/market/resources` returns stock and current resource unit prices. `POST /api/market/resources/sales` requires `resourceCode`, `quantity`, `expectedUnitPrice` and `idempotencyKey`; it rejects stale prices and insufficient stock before atomically crediting the balance.

## Verification

- `npm run prisma:validate` and `npm run prisma:generate`
- `npx prisma migrate deploy` for the configured database
- `npm run test --workspace apps/api` for the timing boundary
- `npm run test:lobby` for purchase authorization, idempotency, first/second-half production, stock, and repeated settlement
- `npm run typecheck` and `npm run lint`
- Run `node --env-file=.env scripts/run-player-visual-test.mjs` for the live player visual flow with a test API on 3101 and proxy on 8081 (web server on 3000). Run `node scripts/visual-check-player-preview.mjs` for the separate UI preview; that script expects the development gateway on 8080.
