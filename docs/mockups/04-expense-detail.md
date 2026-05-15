# 04 · Expense detail (read-only view)

**Route:** `/ledger/[ledgerId]/expense/[expenseId]/`
**Requirements:** SC-FR-HIS-2, SC-FR-SPL-1, SC-FR-SPL-2, SC-FR-SPL-3, SC-FR-EXP-4, SC-FR-EXP-5

Tapped from an expense-list row. Shows every field of a single expense
including how the split was computed and where the rounding went. Two
write actions: Edit (deep-links to screen 03) and Delete (tombstone).

## Default state

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Expenses    Expense details            [ ⋮ ]     │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Groceries (REWE)                                  │
 │   €47.20                                            │
 │   14 May 2026                                       │
 │                                                     │
 │   ── Paid by ──────────────────────────────────────  │
 │                                                     │
 │   Anna                                              │
 │                                                     │
 │   ── Split equally · 3 ways ───────────────────────  │
 │                                                     │
 │    Anna       €15.74    (payer, +€0.01 remainder)   │
 │    Stefan     €15.73                                │
 │    Lukas      €15.73                                │
 │                                                     │
 │   ── Labels ───────────────────────────────────────  │
 │                                                     │
 │   ● food   ● shared                                 │
 │                                                     │
 │   ── Note ─────────────────────────────────────────  │
 │                                                     │
 │   Big shopping run for the week, includes some      │
 │   stuff for the dinner on Saturday.                 │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │                                                     │
 │   Created by Anna · 14 May 2026, 18:42              │
 │   Last edited 14 May 2026, 19:03 by Anna            │
 │                                                     │
 │                                                     │
 │   [ Edit ]                          [ 🗑 Delete ]   │
 └─────────────────────────────────────────────────────┘
```

- The execution-date is in the title block; the entry-timestamp lives in
  the audit lines at the bottom (SC-FR-EXP-1's two-date model made
  visible).
- "Last edited" only appears when the expense has at least one
  `ExpenseUpdated` event after its `ExpenseCreated` (SC-ARC-MRG-2
  last-write-wins is what determines whose name appears).
- The rounding-remainder caption next to the payer's share makes
  SC-FR-SPL-2 transparent — users can audit the breakdown without doing
  the modulo themselves.

## Variant — payer excluded from split (SC-FR-SPL-3)

```
   ── Paid by ──────────────────────────────────────
   Stefan

   ── Split equally · 2 ways · payer excluded ──────
    Anna       €23.60
    Lukas      €23.60
    Stefan     —       (fully reimbursed by the others)
```

The "fully reimbursed" line is informational; it does not appear in the
event payload, only in the rendered view.

## Variant — no labels, no note

The Labels and Note sections collapse entirely (no header, no body) when
their respective fields are empty. The audit lines and action buttons
shift up to fill the space.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap Edit | Navigate to `/ledger/[id]/expense/[expenseId]/edit` (screen 03). |
| Tap Delete | Confirm sheet ("Delete this expense? It will disappear from everyone's view after sync."); on confirm, append `ExpenseDeleted` tombstone and return to expense list. |
| Tap a label dot | Apply that label as a filter and return to the expense list (screen 02). |
| Tap a participant name in the split | Apply that participant as a filter and return to the expense list. |
| Tap `⋮` | Menu: **Duplicate** (pre-fill screen 03 with the same fields, new date = today), **Share text summary** (open share sheet with a plain-text rendering useful when chatting with the payer). |

## Notes for the implementer

- The displayed split breakdown is computed by `domain/splits.ts` from
  `(amount, participants, payerId)` — never read from a stored field.
  Source of truth is the expense record; the breakdown is always derived.
- "Last edited by" looks at the most recent `ExpenseUpdated` event for
  this expense in the folded state. If there is none, the line is hidden.
- The share-text-summary formats roughly as `"Groceries (REWE) — €47.20
  on 14 May 2026, paid by Anna, split 3 ways"`. Plain text, no markdown.
