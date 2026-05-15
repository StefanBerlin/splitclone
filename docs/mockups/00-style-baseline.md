# 00 · Style Baseline

The structural mockups in this folder follow a single visual language.
Pixel-accurate translation to Figma / SwiftUI / Tailwind happens later; this
file fixes the decisions that the wireframes are drawn against.

## Typography

| Use | Token | Notes |
| --- | --- | --- |
| Body | `--font-body`: system-ui (San Francisco / Roboto / Segoe) | No webfonts. Reduces bundle + privacy footprint. |
| Numbers | `--font-tabular`: system-ui with `font-variant-numeric: tabular-nums` | Currency columns must align vertically. |
| Sizes | 13 / 15 / 17 / 22 / 28 px | Hierarchies: caption · body · prominent body · screen title · key figure. |
| Weight | 400 default · 600 emphasis · 700 amounts | Italic reserved for empty-state hints. |

## Palette

Both light and dark variants are defined as CSS custom properties on `:root`
and `[data-theme="dark"]`. The mockups don't show colour; they show contrast
relationships (use `▓` for foreground, `░` for separators).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#111418` | Page background |
| `--surface` | `#f7f7f8` | `#1a1d22` | Card / row background |
| `--text` | `#111418` | `#eaeaec` | Primary text |
| `--text-muted` | `#5a6068` | `#8a9099` | Captions, dates |
| `--accent` | `#0a84ff` | `#5ea7ff` | Buttons, links |
| `--positive` | `#1f9d55` | `#56c08d` | Inflows ( +€ ) |
| `--negative` | `#c83a2e` | `#f0746a` | Outflows ( −€ ) |
| `--warning` | `#b45309` | `#f3a755` | Recovery-code nag, sync error |
| `--border` | `#e3e5e8` | `#272b30` | Separators |

Contrast: every text-over-background pair targets WCAG AA (≥ 4.5:1 for body,
3:1 for large text).

Dark mode follows the OS `prefers-color-scheme`. A manual override (in
Settings) writes a single key in IndexedDB and toggles `data-theme`.

## Spacing scale

`4 · 8 · 12 · 16 · 24 · 32 · 48 px` — six steps, no in-betweens. Touch
targets are ≥ 44 × 44 px (Apple HIG) and ≥ 48 × 48 px on Android
(Material). Row vertical rhythm is 16 px (8 above / 8 below content).

## Iconography

System icons via SVG sprite, **one file** (`/static/icons.svg`) loaded once.
Style: 24 × 24 px outline, 1.5 px stroke, current-colour fill. Avoids icon
fonts and per-icon network requests. Names referenced in mockups: `plus`,
`filter`, `sort`, `share`, `qr`, `eye`, `eye-off`, `chevron-right`,
`chevron-left`, `cloud-check`, `cloud-off`, `cloud-arrow-up`, `cloud-error`,
`label-tag`, `users`, `coin`, `arrow-down`, `arrow-up`, `more-vertical`,
`trash`, `pencil`.

## App-shell skeleton

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Back     Screen title             [ ☁ ] [ ⋮ ]    │   ← top bar (sticky)
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │             screen content (scrolls)                │
 │                                                     │
 ├─────────────────────────────────────────────────────┤
 │  [ Expenses ] [ Balances ] [ Labels ] [ Export ]    │   ← tab bar (only on ledger routes)
 └─────────────────────────────────────────────────────┘
```

- `☁` is the sync-status icon — `cloud-check` (idle) / `cloud-arrow-up`
  (pushing) / `cloud-off` (offline) / `cloud-error` (error). Tapping opens
  the sync-status sheet.
- `⋮` is a context menu. Per-screen contents are listed in each mockup.
- The tab bar only appears inside `ledger/[ledgerId]/*` routes. The landing
  screen and the create/join flows render full-bleed.

## Empty / loading / error variants

Every screen has three implicit variants and any mockup that doesn't list
them inherits the defaults below:

| Variant | Pattern |
| --- | --- |
| Loading | Skeleton rows (`▒▒▒▒▒▒  ▒▒▒▒▒`) for the first 600 ms; spinner only if data is still pending after that. |
| Empty | Single centred line of muted text + a primary action button. No illustration. |
| Error | One-line headline + one-line description in `--warning` colour, "Retry" button. |
