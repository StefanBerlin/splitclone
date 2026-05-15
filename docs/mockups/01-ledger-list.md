# 01 · Ledger list (app entry point)

**Route:** `/`
**Requirements:** SC-FR-LED-1, SC-FR-LED-2, SC-FR-LED-4

The first screen after launch. Lists every ledger the device has previously
joined or created. Offers entry points for creating a new ledger and joining
an existing one.

## Default state (≥ 1 ledger known)

```
 ┌─────────────────────────────────────────────────────┐
 │                SplitClone               [ ⋮ ]       │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │  Your ledgers                                       │
 │                                                     │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  Flatshare — Berlin                           │  │
 │  │  3 participants · last activity 2 h ago    ›  │  │
 │  └───────────────────────────────────────────────┘  │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  Iceland trip 2026                            │  │
 │  │  5 participants · last activity Apr 28     ›  │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  ─────────────────────────────────────────────────  │
 │                                                     │
 │  [ + Create a new ledger ]                          │
 │  [   Join with a code     ]                         │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- Tapping a ledger row → `/ledger/[ledgerId]/` (expense list, screen 02).
- Tapping `+ Create` → `/ledger/new/` (screen 10).
- Tapping `Join with a code` → `/ledger/join/` (screen 11).
- The `⋮` context menu contains: **Connect / Reconnect OneDrive**, **Sign out**, **About**, **View source on GitHub**.

## Empty state (no ledgers yet)

```
 ┌─────────────────────────────────────────────────────┐
 │                SplitClone                           │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │                                                     │
 │              No ledgers on this device              │
 │                                                     │
 │     A ledger keeps shared expenses for one group    │
 │     of people. You can create a new one or join     │
 │     one a friend has shared with you.               │
 │                                                     │
 │           [ + Create a new ledger ]                 │
 │           [   Join with a code     ]                │
 │                                                     │
 │                                                     │
 ├─────────────────────────────────────────────────────┤
 │  Not connected to OneDrive yet  [ Connect ]         │
 └─────────────────────────────────────────────────────┘
```

The OneDrive banner appears only when no Microsoft account is currently
authenticated. Once connected, the banner disappears and `Create` /
`Join` work normally.

## Disconnected / token-expired state

When OneDrive auth has expired but ledgers still exist locally, ledger rows
remain tappable (read-only) and a persistent banner appears between the list
and the action buttons:

```
 │  ⚠  Sign-in to OneDrive expired                     │
 │     [ Reconnect ]                                   │
```

## Row variants

```
  Normal:
   │  Flatshare — Berlin                              │
   │  3 participants · last activity 2 h ago       ›  │

  Pending recovery-code save (SC-ARC-ENC-6):
   │  Flatshare — Berlin       ⚠ Save recovery code  │
   │  3 participants · last activity 2 h ago       ›  │

  Sync error on this ledger:
   │  Iceland trip 2026               ⛅ Sync error   │
   │  5 participants · last activity Apr 28        ›  │
```

The right-aligned chips reuse `--warning` (recovery) / `--negative` (error)
colours from the baseline.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap row | Open ledger (route to screen 02). |
| Long-press row | Action sheet: **Open**, **Show join code**, **Forget on this device**. |
| Pull-to-refresh | Triggers a sync.pull cycle for every visible ledger; refreshes `last activity` and any pending error chips. |
| Swipe-left on row | Quick action: **Forget on this device** (with confirmation; never deletes data on OneDrive). |

## Notes for the implementer

- "Forget on this device" only removes the local IndexedDB entry; the ledger
  files on OneDrive are untouched (matches SC-ARC-LOG-6: no data loss).
- "Last activity" is computed locally from `max(entryAt)` across all
  non-tombstone events; no network call required to render.
- Participant count is from `DerivedState.participants.size`.
