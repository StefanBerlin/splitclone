# 06 · Balances (who owes whom)

**Route:** `/ledger/[ledgerId]/balances`
**Requirements:** SC-FR-BAL-1, SC-FR-BAL-2, SC-FR-BAL-3, SC-FR-BAL-4

The core balances screen. Shows, for the participant claimed by this
device, every counterparty and whether the current user owes or is owed.
Raw pairwise — no debt-simplification re-routing (SC-FR-BAL-4).

## Default state — you have one or more open balances

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Flatshare — Berlin   Balances    [ ☁ ] [ ⋮ ]    │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   ── You owe ──────────────────────────────────────  │
 │                                                     │
 │    Anna                                     €24.60  │
 │       from 4 expenses                          ›    │
 │                                                     │
 │    Lukas                                    € 8.00  │
 │       from 1 expense                           ›    │
 │                                                     │
 │   ── You are owed ─────────────────────────────────  │
 │                                                     │
 │    Lukas                                    €42.15  │
 │       from 6 expenses                          ›    │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │                                                     │
 │    Net for you: +€9.55                              │
 │                                                     │
 │                                                     │
 ├─────────────────────────────────────────────────────┤
 │  [ Expenses ] [ Balances ] [ Labels ] [ Export ]    │
 └─────────────────────────────────────────────────────┘
```

- Two sections: "You owe" (you have a negative position to that person)
  and "You are owed" (positive). Names with zero pairwise balance are
  omitted.
- Lukas can appear in BOTH sections because pairwise balances are
  directional. The MVP does NOT net them across counterparties
  (SC-FR-BAL-4) — that's debt simplification, which is out of scope.
- "from N expenses" is the count of non-deleted expenses contributing to
  this pairwise balance (SC-FR-BAL-1 says it's a pure fold).
- The bottom "Net for you" sums all your pairwise balances. Informational;
  not the same as the simplified-debt number.

## All-settled state

```
 │                                                     │
 │                       ✓                             │
 │                                                     │
 │                  All settled up                     │
 │                                                     │
 │     Nobody owes anyone in this ledger. Add an       │
 │     expense or settlement to see balances here.     │
 │                                                     │
 │           [ + Record settlement ]                   │
```

## Pair detail (tap a row)

Drills into one counterparty pair. Lists every expense and settlement
that contributed to the running balance.

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Balances    Anna ⇄ you           [ ⋮ ]          │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   You owe Anna €24.60                               │
 │                                                     │
 │   ── Recent ───────────────────────────────────────  │
 │                                                     │
 │    14 May  Groceries (REWE)                +€15.74  │
 │            Anna paid, your share                    │
 │                                                     │
 │    13 May  Cleaning supplies                +€6.32  │
 │            Anna paid, your share                    │
 │                                                     │
 │    11 May  Pizza Thursday                  −€10.00  │
 │            You paid, Anna's share                   │
 │                                                     │
 │    07 May  Settlement to Anna               −€3.50  │
 │                                                     │
 │    …                                                │
 │                                                     │
 │                                                     │
 │      [ + Settle up with Anna ]                      │
 └─────────────────────────────────────────────────────┘
```

- Sign convention matches the export's Mode A in the row column: positive
  rows mean "your debt to Anna went up", negative mean "your debt went
  down (you paid, or she paid you back, or she owed you)".
- Tapping a row jumps to the underlying expense or settlement detail.
- `Settle up with Anna` deep-links to the settlement-entry screen
  (07) prefilled with Anna as the counterparty and the current absolute
  balance as the suggested amount.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap pair row | Open pair detail (above). |
| Tap `+ Record settlement` (empty state) | Open settlement entry (screen 07) blank. |
| Tap `+ Settle up with Anna` (pair detail) | Open settlement entry pre-filled. |
| Tap `⋮` (top-bar, balances list) | Menu: **Switch perspective**. Lets the user see balances from another participant's perspective (useful when explaining a balance to someone else). Display only — the device's claimed participant identity is unchanged. |

## Notes for the implementer

- All balance numbers come from `domain/balances.ts` operating on
  `DerivedState`. No I/O, fully testable in isolation.
- The "n expenses" count is a simple filter on the same expense set used
  by the balance computation.
- "Switch perspective" toggles a UI-only `viewAs` participant id; persisted
  in URL query string (so back/forward and deep-links work), not in
  IndexedDB.
- The pair-detail running balance is computed by walking the per-pair
  contribution list in execution-date order — same algorithm as the export
  projection but scoped to one counterparty.
