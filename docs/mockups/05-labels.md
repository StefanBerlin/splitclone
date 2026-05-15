# 05 · Label management

**Route:** `/ledger/[ledgerId]/labels`
**Requirements:** SC-FR-LBL-1, SC-FR-LBL-2, SC-FR-LBL-3, SC-FR-LBL-4, SC-FR-LBL-5, SC-FR-LBL-6

The dedicated screen for the ledger's label list. Lists every label with a
usage count and offers create / rename / delete.

## Default state (≥ 1 label)

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Flatshare    Labels             [ ☁ ] [ ⋮ ]     │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   [ + New label ]                                   │
 │                                                     │
 │   ●  food                                42 expenses│
 │                                                  ›  │
 │   ●  shared                              35 expenses│
 │                                                  ›  │
 │   ●  travel                              18 expenses│
 │                                                  ›  │
 │   ●  cash                                 7 expenses│
 │                                                  ›  │
 │   ●  one-off                              2 expenses│
 │                                                  ›  │
 │                                                     │
 ├─────────────────────────────────────────────────────┤
 │  [ Expenses ] [ Balances ] [ Labels ] [ Export ]    │
 └─────────────────────────────────────────────────────┘
```

- Labels sorted by usage count, descending. Ties broken alphabetically.
- "N expenses" counts non-tombstoned expenses currently carrying the
  label (SC-FR-LBL-6).
- Tap row → label detail (below).
- The `⋮` menu contains: **Sort alphabetically** (toggle, default off),
  **Show unused only** (filter, shows labels with 0 expenses for cleanup).

## Empty state

```
 │                                                     │
 │                                                     │
 │                  No labels yet                      │
 │                                                     │
 │     Labels are short tags like "food" or            │
 │     "trip-paris" you can attach to expenses for     │
 │     filtering and grouping.                         │
 │                                                     │
 │              [ + New label ]                        │
 │                                                     │
```

## New / rename modal

Same modal for both, only the title differs.

```
 ┌─────────────────────────────────────────────────────┐
 │             New label             Cancel     Save   │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Name                                              │
 │   ┌───────────────────────────────────────────────┐ │
 │   │                                               │ │
 │   └───────────────────────────────────────────────┘ │
 │   Short, lowercase tags work best. Max 40 chars.    │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

Validation:

```
  Already exists (case-insensitive duplicate, SC-FR-LBL-2):
   │  ⚠  A label "food" already exists in this        │
   │     ledger.                                      │

  Too long:
   │  ⚠  Labels are limited to 40 characters.         │
```

## Label detail (tap a row)

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Labels      food                          Save   │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Name                                              │
 │   ┌───────────────────────────────────────────────┐ │
 │   │ food                                          │ │
 │   └───────────────────────────────────────────────┘ │
 │                                                     │
 │   Used on 42 expenses                               │
 │   [ Show expenses with this label ]                 │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │                                                     │
 │   [ 🗑 Delete this label ]                           │
 │                                                     │
 │   Deleting removes the label from every expense     │
 │   that carries it. The expenses themselves stay     │
 │   intact (SC-FR-LBL-4).                             │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- Save is disabled until the name has changed AND is non-empty AND is
  not a duplicate of another label.
- "Show expenses with this label" deep-links to the expense list with the
  label filter pre-set to this label only (drives screen 02).

## Delete confirmation

```
 ┌─────────────────────────────────────────────────────┐
 │   Delete "food"?                                    │
 │                                                     │
 │   42 expenses currently carry this label. The       │
 │   label will be removed from all of them; the       │
 │   expenses themselves are kept.                     │
 │                                                     │
 │   This cannot be undone.                            │
 │                                                     │
 │            [ Cancel ]      [ Delete ]               │
 └─────────────────────────────────────────────────────┘
```

`Delete` is the destructive (red) button per the style baseline.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap row | Open label detail. |
| Tap `+ New label` | Open new-label modal. |
| Long-press row | Action sheet: **Rename**, **Delete**, **Show expenses**. |
| Tap "Show expenses with this label" | Navigate to expense list with label filter set. |

## Notes for the implementer

- Label CRUD goes through events: `LabelCreated`, `LabelRenamed`,
  `LabelDeleted` (SC-ARC-LOG-2). Renames preserve the label UUID so
  existing expense-to-label references survive.
- Deletion is a tombstone (SC-FR-LBL-4); the derived state simply elides
  expense references to UUIDs that no longer have a corresponding
  non-tombstoned `LabelCreated`. No mutation of expense events occurs.
- Usage counts are computed on demand from `DerivedState`. Cheap because
  labels per expense are small arrays.
- A "show unused only" toggle from the `⋮` menu is implemented as a local
  filter in the Svelte store, not in the URL — it's a transient cleanup
  aid, not a deep-linkable view.
