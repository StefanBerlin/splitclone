# 03 · Expense entry (create / edit)

**Routes:** `/ledger/[ledgerId]/expense/new` and `/ledger/[ledgerId]/expense/[id]/edit`
**Requirements:** SC-FR-EXP-1, SC-FR-EXP-2, SC-FR-EXP-3, SC-FR-EXP-4, SC-FR-SPL-1, SC-FR-SPL-3, SC-FR-LBL-5

The most-used write action in the app. Single screen for both create and
edit. Edit mode pre-fills every field and changes the submit-button label.

## Create state — empty

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel        New expense                  Save  │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │  Title                                              │
 │  ┌───────────────────────────────────────────────┐  │
 │  │ e.g. Groceries (REWE)                         │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Amount                                             │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  €  0.00                                      │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Date it happened                                   │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  14 May 2026          ▼                       │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Paid by                                            │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  You (Stefan)         ▼                       │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Split among                                        │
 │   [✓] Anna     [✓] Stefan     [✓] Lukas             │
 │   Equal split — each owes €0.00 so far.             │
 │                                                     │
 │  Labels  (optional)                                 │
 │   [ + ] [ food ] [ shared ] [ travel ] …            │
 │                                                     │
 │  Note  (optional)                                   │
 │  ┌───────────────────────────────────────────────┐  │
 │  │                                               │  │
 │  │                                               │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- **Save** button in the top-right is disabled until `Title` is non-empty
  and `Amount` > 0.
- The execution-date picker defaults to today (SC-FR-EXP-1). The entry
  timestamp is captured on Save and is **not** shown in the form (it's
  visible later in the detail view).
- "Paid by" dropdown lists all participants; the device's claimed
  participant is at the top labelled "You (Name)".
- "Split among" shows participant chips. Tap to toggle (one of: payer,
  another participant, or both — payer can be excluded per SC-FR-SPL-3).
  The inline summary updates live with the per-person share once `Amount`
  is non-zero.
- "Labels" row shows a `+` chip (opens picker) plus the most-recent 4
  labels for one-tap toggle. Selected labels render in `--accent`; the
  `…` indicates "more in picker".

## Live split summary

Once `Amount` and the participant set are valid:

```
 │   [✓] Anna     [✓] Stefan     [✓] Lukas             │
 │   Equal split — €15.74 each (€47.20 ÷ 3).           │
 │   Rounding remainder of €0.02 added to your share.  │ ← only when applicable
```

The remainder caption explains SC-FR-SPL-2 visibly so the user isn't
surprised by an asymmetric breakdown. It only appears when the modulo is
non-zero.

If the payer is unchecked (treating-others case):

```
 │   [✓] Anna     [ ] Stefan     [✓] Lukas             │
 │   Equal split — €23.60 each. You are reimbursed in  │
 │   full.                                             │
```

## Edit state

Same screen, pre-filled, with subtle differences:

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel        Edit expense                 Save  │
 ├─────────────────────────────────────────────────────┤
 │  …same fields, pre-filled…                          │
 │                                                     │
 │  ─────────────────────────────────────────────────  │
 │  [ 🗑  Delete this expense ]                         │
 │                                                     │
 │   Created by Anna on 28 Apr 2026, 15:32             │   ← entry-timestamp audit line
 └─────────────────────────────────────────────────────┘
```

The audit line at the bottom shows the original entry timestamp and author
(SC-FR-EXP-1) — read-only.

## Validation and errors

```
  Amount required (after tap on Save with empty amount):
   │  Amount                                          │
   │  ┌──────────────────────────────────────────────┐│
   │  │  €  0.00                                     ││
   │  └──────────────────────────────────────────────┘│
   │  ⚠  Enter an amount greater than zero.          │

  No participants in split:
   │  Split among                                     │
   │   [ ] Anna     [ ] Stefan     [ ] Lukas          │
   │  ⚠  Choose at least one person to split between. │
```

## Interactions

| Gesture | Result |
| --- | --- |
| Tap Save | Build event, append to segment store, optimistic update of expense list, dismiss screen. |
| Tap Cancel | Confirm if any field has changed; otherwise dismiss. |
| Tap Delete (edit only) | Confirm sheet ("Delete this expense? Other devices will see it disappear after sync."), then tombstone via `ExpenseDeleted`. |
| Tap a label chip | Toggle that label's inclusion. |
| Tap `+` on labels | Open the labels picker (multi-select; surfaces the full list from screen 05). |
| Tap "Paid by" | Open participant picker sheet. |
| Tap date | Open native iOS date picker (calendar). |

## Notes for the implementer

- The form is dispatch-only: every Save produces exactly one event
  (`ExpenseCreated` or `ExpenseUpdated`) and routes it through
  `segment-store.append`.
- Money input uses the `<MoneyInput>` component which stores `bigint` cents
  internally; the visible "0.00" is purely display formatting.
- The labels chip row is virtualised horizontally when > 8 recent labels
  exist; the full picker opens via `+`.
- All field state lives in component-local stores; nothing is written to
  the ledger until Save. Drafts are NOT persisted across navigation in MVP
  (decided implicitly — call out in screen review if you disagree).
