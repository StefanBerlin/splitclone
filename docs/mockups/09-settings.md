# 09 · Sync status sheet and Ledger settings

**Routes:** Sync sheet is modal from the top-bar cloud icon; settings is
`/ledger/[ledgerId]/settings`.
**Requirements:** SC-FR-SYN-1, SC-FR-SYN-2, SC-FR-SYN-3, SC-FR-LED-3, SC-FR-PRT-1, SC-FR-PRT-2, SC-FR-PRT-3, SC-FR-PRT-4, SC-ARC-ENC-6

This file covers two adjacent surfaces because they are typically used in
sequence: the user notices a sync state from the cloud icon, opens the
sync sheet, and from there can drill into ledger settings for deeper
configuration.

## Sync status sheet (modal from top-bar cloud icon)

Pulls up from the bottom on iOS / Android; centred dialog on desktop.

### Idle / in sync

```
                  ─── drag handle ───
 ┌─────────────────────────────────────────────────────┐
 │  Sync                                          ✕    │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   ✓  In sync                                        │
 │   Last successful sync 12 seconds ago.              │
 │                                                     │
 │              [ Sync now ]                           │
 │                                                     │
 │   ── Details ──────────────────────────────────────  │
 │                                                     │
 │   Local pending changes         0                   │
 │   Local segments (this device)  3                   │
 │   Remote devices known          2                   │
 │   Local cache refreshed         18:42               │
 │                                                     │
 │   OneDrive folder                                   │
 │    /Apps/SplitClone/flatshare-berlin/               │
 │    [ Open in OneDrive ]                             │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

### Pulling / pushing

```
 │   ⟳ Pulling from OneDrive…                          │
 │   Refreshing changes from 2 remote devices.         │
```

```
 │   ⟳ Uploading 3 pending changes…                    │
 │   1 of 3 segments uploaded.                         │
```

### Offline

```
 │   ⛅ Offline                                         │
 │                                                     │
 │   3 changes will sync when you're back online.      │
 │   You can keep using SplitClone normally.           │
```

### Error

```
 │   ⚠ Sync failed                                     │
 │   "Microsoft Graph returned 401: token expired."    │
 │                                                     │
 │   [ Reconnect OneDrive ]    [ Try again ]           │
```

Each error variant shows the underlying reason in plain text. The
"Reconnect OneDrive" button is shown only for auth-related errors; the
"Try again" button is shown for transient transport errors.

## Ledger settings screen

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Flatshare     Ledger settings                    │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   ── Ledger ───────────────────────────────────────  │
 │                                                     │
 │   Name                                              │
 │   ┌──────────────────────────────────────────────┐  │
 │   │ Flatshare — Berlin                            │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   Currency:               EUR — Euro                │
 │   Created:                14 May 2026               │
 │   Schema version:         1                         │
 │   Ledger ID:              01J2C…  [ Copy ]          │
 │                                                     │
 │   ── Sharing ──────────────────────────────────────  │
 │                                                     │
 │   Recovery code                                     │
 │   [ Show / share recovery code ]                    │
 │                                                     │
 │   To add somebody to this ledger, give them BOTH    │
 │   the recovery code AND access to the OneDrive      │
 │   folder. Neither alone is enough.                  │
 │                                                     │
 │   ⚠  You have not yet confirmed that you saved      │
 │      the recovery code.        [ Confirm now ]      │
 │                                                     │
 │   ── Participants ─────────────────────────────────  │
 │                                                     │
 │   Anna             claimed on this device           │
 │   Stefan           claimed on another device        │
 │   Lukas            not yet claimed                  │
 │                                                     │
 │   [ + Add a participant ]                           │
 │                                                     │
 │   ── This device ──────────────────────────────────  │
 │                                                     │
 │   Theme                System ▼                     │
 │   Sync on app focus    [✓]                          │
 │   Background sync      [ ] (not supported on iOS)   │
 │                                                     │
 │   ─────────────────────────────────────────────────  │
 │                                                     │
 │   [ Forget this ledger on this device ]             │
 │    Removes only the local cache. The data on        │
 │    OneDrive is not deleted. You can rejoin with     │
 │    the recovery code later.                         │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- The "not yet confirmed recovery code" banner only appears while the
  acknowledgement flag from screen 10 is still false. Tapping
  `Confirm now` shows the code one more time and offers the
  acknowledgement checkbox in a sheet.
- "Show / share recovery code" displays the same QR + spaced base64url
  string from screen 10, plus the four save-it-somewhere buttons. No
  acknowledgement gate this time (user already created the ledger).
- Background sync row is shown disabled on iOS Safari with the explainer
  inline (SC-NFR-OFF-1's known limitation).
- "Forget this ledger on this device" removes the IndexedDB entries for
  this ledger only; OneDrive data is untouched. Rejoining works exactly
  like a first-time join (screen 11).

## Adding a participant from settings (SC-FR-PRT-1, SC-FR-PRT-4)

`+ Add a participant` opens a modal:

```
 ┌─────────────────────────────────────────────────────┐
 │   New participant            Cancel        Add      │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Display name                                      │
 │   ┌──────────────────────────────────────────────┐  │
 │   │                                              │  │
 │   └──────────────────────────────────────────────┘  │
 │                                                     │
 │   ℹ  This adds the person to the ledger so they     │
 │      can be included in splits. They do NOT need    │
 │      to run SplitClone — you can include flatmates  │
 │      or friends who never join the app              │
 │      (SC-FR-PRT-4).                                 │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

The participant is added by writing a `ParticipantAdded` event. No
`ParticipantClaimed` event is written — that happens later if/when the
new participant actually joins on their own device.

## Renaming a participant

Tap a participant row → name field becomes editable inline. Save writes
`ParticipantRenamed`. The participant's UUID never changes (SC-FR-PRT-3).

## Interactions

| Gesture | Result |
| --- | --- |
| Tap cloud icon in top bar | Open sync status sheet. |
| Tap Sync now | Trigger manual pull + push (SC-FR-SYN-2). |
| Tap Reconnect OneDrive | Navigate to `/auth/start` (PKCE flow). |
| Tap `⋮` on a ledger → Ledger settings | Open settings screen. |
| Tap a participant row | Inline rename (SC-FR-PRT-3). |
| Tap `+ Add a participant` | Open add-participant modal. |
| Tap Forget on this device | Confirm sheet, then drop the ledger's IndexedDB store and return to the ledger list. |

## Notes for the implementer

- The sync sheet is a sibling of the expense-list route, not a route of
  its own; backing out simply dismisses it.
- The "Local cache refreshed" timestamp is updated after every successful
  pull cycle. It's purely informational; the actual sync cadence is
  driven by focus events (SC-FR-SYN-1).
- "Background sync — not supported on iOS" is shown ALWAYS on iOS Safari
  (the API isn't there); on Chromium it can be toggled by the user.
- "Forget on this device" must NOT delete or modify any file on
  OneDrive. It is local-cache eviction only. This is the same as the
  swipe-action on the ledger-list screen (01).
