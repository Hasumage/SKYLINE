# Open questions

Updated 2026-10-24. Current behavior is in [implementation status](../IMPLEMENTATION_STATUS.md); these are decisions still needed before adding game rules.

- Whether the six seeded objects, base/current price steps and per-quarter yields are final for a full tournament; they are implemented defaults, not approved final balancing.
- Resource demand model and who may change the current per-session resource price. It currently starts at the base value and stays there unless changed directly in the database.
- Exact II/III combination recipes, outputs, solo/team contribution rules, contract terms and settlement. The player preview is not a specification for persistent mechanics.
- Tender rewards and when they are paid; contributions already consume stock.
- Patent coefficient target, rounding and income timing; registration alone does not change production or balance.
- Medical event catalog, penalties, team responses, duration/expiry behavior and interaction with production.
- Mayor goals, emergencies and decrees: approved inputs, authority and backend effects.
- Credit schedule: the current total uses simple quarterly interest and shows a per-quarter amount, but repayments are manual cash operations. Decide due dates, late/default behavior and any automatic payment before implementing them.
- Whether and how to implement `PAUSED`, including its effect on elapsed time and quarter settlement.
- Privacy rule for other teams' electronic balances in snapshots; the current API exposes them.
- Organizer authentication beyond the `create` command and device identity beyond local storage.

Already fixed in code: a purchase strictly before the quarter midpoint can produce that quarter; one at/after it starts next quarter. The organizer can configure 10-30 quarters of 5-10 minutes, start needs two teams of two players, and the match expires one hour after scheduled play. The catalog has separate internal base and player-facing current prices. Staff construction is cash; player market purchases are electronic.

