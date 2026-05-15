# 07 · Settlement entry

**Routes:** `/ledger/[ledgerId]/settle/new` and `/ledger/[ledgerId]/settle/[id]/edit`
**Requirements:** SC-FR-BAL-3, SC-FR-BAL-4 (out-of-scope contrast)

Records a payment between two participants — the action that brings a
pairwise balance back toward zero. Single screen for both create and
edit, mirroring the expense-entry pattern.

## Create state — empty

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel       Record settlement           Save    │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   From                                              │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ You (Stefan)         ▼                       │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   To                                                │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ Anna                 ▼                       │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   Amount                                            │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ € 0.00                                       │  │
 │   └──────────────────────────────────────────────┘  │
 │    Current balance: you owe Anna €24.60   [ Use ]   │
 │                                                     │
 │   Date                                              │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ 14 May 2026          ▼                       │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   Note (optional)                                   │
 │   ┌──────────────────────────────────────────────┐  │
 │   │                                              │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │                                                     │
 │   ℹ  Settlements record real money moving between   │
 │      two people. They reduce the balance between    │
 │      those two, not other balances in the ledger    │
 │      (SC-FR-BAL-4).                                 │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- `From` defaults to "You (...)"; the current device's claimed
  participant. Either dropdown can be changed to any other participant.
- The inline balance hint below `Amount` shows the current pairwise
  balance between the chosen From and To and offers a one-tap `Use` to
  populate the amount with the absolute balance — common case is
  "settle all the way".
- The bottom info paragraph is shown only when at least two pairwise
  balances exist in the ledger (i.e. the explanation is relevant). It
  pre-empts the question "why didn't this settlement cancel my balance
  with Lukas too?".

## Deep-link variant — pre-filled from Balances

When opened via the "Settle up with Anna" button on screen 06, `From` and
`To` are pre-selected and `Amount` is pre-filled with the absolute
balance:

```
 │   From      ┌────── You (Stefan) ─▼ ───┐            │
 │   To        ┌────── Anna ─────────▼ ───┐            │
 │   Amount    ┌────── € 24.60 ──────────┐            │
 │              Settles your balance with Anna.        │
```

The `Use` shortcut disappears (already used); the hint becomes "Settles
your balance with Anna" in `--positive`.

## Edit state

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel        Edit settlement              Save  │
 ├─────────────────────────────────────────────────────┤
 │   …same fields, pre-filled…                         │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │   [ 🗑  Delete this settlement ]                     │
 │                                                     │
 │   Recorded by Stefan on 14 May 2026, 19:30          │
 └─────────────────────────────────────────────────────┘
```

Audit line at the bottom matches the expense-entry pattern (screen 03).
Deleting tombstones via `SettlementDeleted`.

## Validation

```
  Same person on both sides:
   │  From    You (Stefan)                            │
   │  To      You (Stefan)                            │
   │  ⚠  From and To must be different people.        │

  Zero amount:
   │  Amount  € 0.00                                  │
   │  ⚠  Enter an amount greater than zero.           │
```

## Interactions

| Gesture | Result |
| --- | --- |
| Tap Save | Build `SettlementRecorded` event, append, optimistic UI update on Balances + Expense list timeline, dismiss. |
| Tap Cancel | Confirm if any field changed. |
| Tap `Use` (balance hint) | Set Amount to the absolute current pairwise balance. |
| Tap From / To | Open participant picker sheet (same component as expense entry). |
| Tap date | Native date picker. |
| Tap Delete (edit only) | Confirm sheet, then `SettlementDeleted` tombstone. |

## Notes for the implementer

- The pairwise balance hint reads from the same `domain/balances.ts`
  used on screen 06. No bespoke calculation here.
- The `Use` shortcut takes the **absolute** value of the current balance
  so the form always shows a positive amount; the direction is encoded by
  the From/To selection.
- A settlement event payload contains: `{ fromParticipantId,
  toParticipantId, amount, date, note? }`. No "received" vs "paid"
  flag; the direction is implicit in From/To.
- The "Settles your balance with Anna" hint is purely UI; the event
  doesn't carry it. If the balance has changed between deep-link entry
  and Save (because another device added an expense in the meantime),
  the settlement still applies as recorded — it's not magically resized.
