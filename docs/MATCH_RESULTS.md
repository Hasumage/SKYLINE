# Match results

At the end of a session, each team's score is calculated from its final assets:

`score = building points + resource points - max(0, outstanding debt - electronic balance)`

- Building points are the sum of `quantity * purchase_base_price` for owned objects. Their current market price and negotiated purchase price do not affect the score.
- Resource points are the sum of `quantity * base_unit_price` for resources remaining in stock. Current market prices do not affect the score.
- Outstanding debt is the amount required to repay active loans in the final quarter, including interest accrued through that quarter. Electronic balance offsets debt only; any excess balance earns no points. Physical cash is not tracked or scored.
- The highest score wins. Teams with the same highest score share first place. Scores may be negative.

Results are recorded in PostgreSQL, not recalculated when a client opens the results screen. `match_score_snapshots` stores one row per team at start (quarter 0), after each committed quarter, and at finalization. Each row keeps the score, rank, winner flag, balance, building/resource totals, debt and deduction, together with a rule version and timestamp. The `(sessionId, phase, quarterNumber, teamId)` key prevents duplicate snapshots. Quarter settlement, tender payout and the corresponding score snapshot commit in the same transaction. Manual finish settles open tenders and saves the final snapshot in the finish transaction.

Finished-session snapshots expose the saved `results` and the full `resultHistory` to players, staff and the organizer. Each history row has `phase`, `quarter` and `recordedAt` for plotting score progression later. Changing market prices or underlying team state after finalization cannot change saved results. Gameplay interfaces for staff and players are replaced with the results view; the organizer and projector retain access to their controls. The UI does not yet graph the stored history.
