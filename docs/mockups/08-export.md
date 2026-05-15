# 08 · Export (mode picker · filter recap · share)

**Route:** `/ledger/[ledgerId]/export`
**Requirements:** SC-FR-EXR-1, SC-FR-EXR-2, SC-FR-EXR-3, SC-FR-EXR-4, SC-FR-EXR-5, SC-FR-EXR-6, SC-FR-EXR-7

One screen. Picks a participant perspective, picks Mode A (Cash) or Mode B
(Virtual), recaps which filters from the expense list are being applied,
generates the CSV, and offers download or share.

## Default state

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Flatshare — Berlin    Export       [ ⋮ ]        │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Export expenses for ...                           │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  You (Stefan)              ▼                  │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │   Mode                                              │
 │   (•) Cash basis                                    │
 │       Money that actually moved in and out of       │
 │       your account. Use this to reconcile against   │
 │       your real bank or card.                       │
 │                                                     │
 │   ( ) Virtual account                               │
 │       Each joint expense moves the balance by your  │
 │       share. Use this if you keep a SplitClone      │
 │       sub-account inside your finance app.          │
 │                                                     │
 │   Filters applied                                   │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ Date    01 May – 14 May 2026                 │  │
 │   │ Labels  food, shared                         │  │
 │   │ People  (no filter)                          │  │
 │   │                              [ Change ]      │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   Preview                                           │
 │   12 rows · €87.40 total outflow                    │
 │                                                     │
 │                                                     │
 │                          [ Export CSV ]             │
 └─────────────────────────────────────────────────────┘
```

- The participant picker defaults to the device's claimed participant
  (SC-FR-EXR-2). Picking somebody else is supported but lightly de-
  emphasised — most users export their own view.
- Mode descriptions are intentionally written in user language; the
  underlying math (SC-FR-EXR-3) is hidden behind plain-English summaries.
- The filter recap mirrors whatever filters were active on the expense
  list (SC-FR-EXR-5). "Change" deep-links back to screen 02 with those
  filters editable.
- The preview line counts rows under the current settings without
  rendering the full CSV — purely metadata: row count and total absolute
  amount.

## Mode = Virtual variant

Selecting Virtual updates the preview line and changes the export
filename suffix:

```
 │   Preview                                           │
 │   18 rows · €127.55 cumulative virtual-account     │
 │   activity                                          │
```

The "cumulative virtual-account activity" wording emphasises that this is
NOT what flowed through a real account; it's the sum of debits + credits
on the virtual sub-account.

## After tapping Export

The browser-download path triggers immediately. On platforms with Web
Share API and file support, both options are offered:

```
 │                                                     │
 │   ✓  Exported splitclone_flatshare-berlin_stefan   │
 │       _cash_20260514-184230.csv                     │
 │                                                     │
 │   [ Open in another app… ]   [ Done ]               │
 │                                                     │
```

`Open in another app…` invokes `navigator.share({ files: [...] })`. On
iOS Safari this lands in the standard share sheet (Mail, Files, …).
On browsers without Web Share file support, the button is hidden — the
file is already in the user's downloads.

## Empty filter result

If the current filter combination yields zero rows:

```
 │   Preview                                           │
 │   No rows match the current filters.                │
 │                                                     │
 │                          [ Export CSV ]    disabled │
```

## Filename pattern (SC-FR-EXR-6)

```
splitclone_<ledger-slug>_<participant-slug>_<mode>_<YYYYMMDD-HHMMSS>.csv

Examples:
  splitclone_flatshare-berlin_stefan_cash_20260514-184230.csv
  splitclone_iceland-trip-2026_anna_virtual_20260601-101005.csv
```

The mode token (`cash` or `virtual`) appears explicitly so a user
re-importing a file weeks later cannot accidentally feed the wrong
projection into the wrong account in WISO Mein Geld / similar.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap participant ▼ | Sheet listing all participants; default selection is "You (…)". |
| Tap a mode radio | Updates the preview row in place. |
| Tap Change (filters) | Navigates back to the expense list with filter chips focused; returning to Export carries the new filters. |
| Tap Export CSV | Build rows via `domain/projection/cash.ts` or `virtual.ts`, format via `export/csv.ts`, deliver via `export/deliver.ts`. |
| Tap Open in another app… | Calls `navigator.share` with the same Blob. |
| Tap Done | Navigate back to the expense list. |

## Notes for the implementer

- The CSV is built lazily on Export tap — never on every keystroke of the
  filter UI. The preview line uses cheap counters over `DerivedState`.
- Row construction is a pure function of (`DerivedState`, participantId,
  mode, filters). Make sure the test suite has at least one example per
  cell of the SC-FR-EXR-3 truth table for both modes.
- The "Open in another app…" button must be feature-detected with
  `navigator.canShare?.({ files: [new File(...)] })` — Web Share file
  support is not universal.
- Filename slugification: lowercase, ASCII-only, hyphenate spaces and
  non-ASCII. Deterministic — given the same ledger and participant, the
  prefix part stays stable.
