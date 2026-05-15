# 02 · Expense list (ledger main view)

**Route:** `/ledger/[ledgerId]/`
**Requirements:** SC-FR-HIS-1, SC-FR-HIS-2, SC-FR-HIS-3, SC-FR-HIS-4, SC-FR-HIS-5, SC-FR-SYN-3

Central screen of the app. Chronological list of expenses for one ledger,
newest first, with filters by participant, label, and date range.

## Default state

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Flatshare — Berlin             [ ☁ ] [ ⋮ ]       │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │  [ All people ▼ ]  [ All labels ▼ ]  [ Any date ▼ ] │   ← filter chips
 │                                                     │
 │  ─── Today ───────────────────────────────────────  │
 │                                                     │
 │   Groceries (REWE)                       −€ 47.20   │
 │   paid by Anna · split 3 ways                       │
 │   ● food   ● shared                                 │
 │                                                  ›  │
 │  ───────────────────────────────────────────────── │
 │   Pizza Thursday                         −€ 32.00   │
 │   paid by Stefan · split 2 ways                     │
 │   ● food                                            │
 │                                                  ›  │
 │  ─── 12 May 2026 ────────────────────────────────── │
 │                                                     │
 │   Cleaning supplies                      −€ 18.95   │
 │   paid by you · split 3 ways                        │
 │   ● shared                                          │
 │                                                  ›  │
 │  ─── … ───                                          │
 │                                                     │
 ├─────────────────────────────────────────────────────┤
 │  [ Expenses ] [ Balances ] [ Labels ] [ Export ]    │
 └─────────────────────────────────────────────────────┘

                                              ┌─────┐
                                              │  +  │  ← FAB: new expense
                                              └─────┘
```

- Section headers group by execution-date: "Today", "Yesterday", absolute
  dates beyond that.
- Each row shows: title, total amount, payer, split arity, label dots
  (a `●` per label, max 3 inline; "+N" overflow chip beyond that).
- Tap row → `/ledger/[id]/expense/[expenseId]/` (screen 04 — detail/edit).
- Floating action button bottom-right → `/ledger/[id]/expense/new/`
  (screen 03 — entry).
- The `☁` cloud icon in the top bar mirrors `syncStatus` (see baseline 00).
  Tapping it opens the sync-status sheet (screen 09).
- The `⋮` menu contains: **Filter…**, **Sort: newest first ✓**, **Sort: highest first**, **Share join code**, **Ledger settings**.

## Filter chips

Each chip shows the active filter or "All …" when unset. Tapping opens a
sheet:

```
   Tap "All people ▼"
   ┌─────────────────────────────────────────────────┐
   │  Filter by participant                          │
   │                                                 │
   │  [✓] Everyone                                   │
   │  [ ] Anna                                       │
   │  [ ] Stefan                                     │
   │  [ ] Lukas                                      │
   │                                                 │
   │              [ Cancel ]   [ Apply ]             │
   └─────────────────────────────────────────────────┘
```

Label filter sheet supports multi-select with OR semantics across labels
(SC-FR-HIS-4 — comment in the spec). Date sheet provides a from/to date
pair, either bound optional (SC-FR-HIS-5).

Active filters compound (AND across the three dimensions). When ≥ 1 filter
is active, a "Clear all" link appears under the chip row.

## Filtered (with results)

```
 │  [ Anna ▼ ]  [ food, shared ▼ ]  [ This month ▼ ]  │
 │                                  Clear all          │
 │                                                     │
 │  3 expenses · €92.15 total                          │   ← summary strip
 │                                                     │
 │   Groceries (REWE)             …                    │
 │   …                                                 │
```

The summary strip appears only when any filter is active; it counts and sums
matching expenses (sum uses the absolute total, not Mode-A/B projections —
that's only on the export screen).

## Filtered with no results

```
 │  [ Lukas ▼ ]  [ travel ▼ ]  [ This week ▼ ]        │
 │                                  Clear all          │
 │                                                     │
 │            No matching expenses                     │
 │                                                     │
 │      Try widening one of the filters above.         │
```

## Loading and offline variants

```
  Loading (initial cold-start, before fold completes):
   │  ▒▒▒▒▒▒▒▒▒▒                              ▒▒▒▒▒▒  │
   │  ▒▒▒▒▒▒▒▒▒                                       │
   │  ─────────────────────────────────────────────── │
   │  ▒▒▒▒▒▒▒                                ▒▒▒▒▒▒   │
   │  ▒▒▒▒▒▒▒▒▒▒                                      │

  Offline banner (above filter chips):
   │  ⚠  Offline — changes will sync when reconnected │
```

## Interactions

| Gesture | Result |
| --- | --- |
| Tap row | Open detail (screen 04). |
| Long-press row | Action sheet: **Edit**, **Duplicate**, **Delete**. Delete prompts a confirm before tombstoning (SC-FR-EXP-5). |
| Pull-to-refresh | Trigger sync.pull. |
| Swipe-left on row | Quick action: **Delete** (with confirm). |
| Tap label dot | Apply that label as a filter (one tap == set the label filter to just that label). |
| Tap participant name in subtitle | Apply that participant as a filter. |

## Notes for the implementer

- Filter state lives in the URL query string (`?people=…&labels=…&from=…&to=…`)
  so back/forward and deep links work. The Svelte `filters` store reads from
  the URL.
- The rendered list is virtualised once it exceeds ~200 rows; below that,
  plain rendering keeps things simple.
- Section grouping by execution-date is a pure derived view; do not store
  it.
- The "you" pronoun appears wherever the current device's claimed
  participant is referenced. Other devices see the participant's real name
  in the same slot.
