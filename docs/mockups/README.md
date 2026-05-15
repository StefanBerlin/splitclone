# SplitClone — UI Mockups

**Status:** draft v0.1, 2026-05-14
**Implements:** Q8(b) of [requirements.sdoc](../requirements.sdoc)
**Format:** ASCII wireframes in Markdown, one screen per file.

These mockups exist to fix the **structural language** of the UI: what is on
each screen, how the user navigates between screens, what state variants
exist. They are deliberately not pixel-accurate. Visual fidelity (typography
choices, icon set, exact spacing in points) lives in `00-style-baseline.md`.

## Reading the wireframes

| Symbol | Meaning |
| --- | --- |
| `┌─ ─┐ │ └─┘` | Box / panel boundaries |
| `[ Label ]`  | Tap target / button |
| `‹ Back`     | iOS-style back affordance |
| `( )`         | Radio button (selected: `(•)`) |
| `[ ]`         | Checkbox (selected: `[✓]`) |
| `▼`           | Dropdown / disclosure |
| `…`           | Truncation / overflow |
| `▒`           | Skeleton / loading placeholder |
| Comment lines `# …` | Per-region annotation, not rendered |
| `→ next-screen.md` | Navigation target |

The portrait-iPhone baseline (~390 px wide) is the canonical width below.
Wider viewports get progressively-enhanced layout (covered in
`00-style-baseline.md`).

## Screen inventory

Status legend: ✅ first draft committed · 🚧 in progress · ⬜ not yet started

| # | Screen | File | Status |
| - | --- | --- | --- |
| — | Style baseline (typography, palette, dark mode, spacing) | [00-style-baseline.md](00-style-baseline.md) | ✅ |
| 1 | Ledger list (app entry point) | [01-ledger-list.md](01-ledger-list.md) | ✅ |
| 2 | Expense list (ledger main view, with filters) | [02-expense-list.md](02-expense-list.md) | ✅ |
| 3 | Expense entry (create / edit) | [03-expense-entry.md](03-expense-entry.md) | ✅ |
| 4 | Expense detail (read-only view) | [04-expense-detail.md](04-expense-detail.md) | ✅ |
| 5 | Label management | [05-labels.md](05-labels.md) | ✅ |
| 6 | Balances (who owes whom) | [06-balances.md](06-balances.md) | ✅ |
| 7 | Settlement entry | [07-settlement-entry.md](07-settlement-entry.md) | ✅ |
| 8 | Export (mode picker + filter + share) | [08-export.md](08-export.md) | ✅ |
| 9 | Sync status / settings | [09-settings.md](09-settings.md) | ✅ |
| 10 | Create ledger (incl. recovery-code prompt) | [10-create-ledger.md](10-create-ledger.md) | ✅ |
| 11 | Join ledger (paste / QR-scan join code) | [11-join-ledger.md](11-join-ledger.md) | ✅ |

Sign-off note: per SC-NFR-PLT-1 / Q8, no production code starts until both
this set (all rows ✅) and `architecture.md` are reviewed.
