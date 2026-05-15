# 10 · Create ledger (with recovery-code prompt)

**Route:** `/ledger/new/`
**Requirements:** SC-FR-LED-1, SC-FR-LED-3, SC-FR-EXP-2 (currency choice), SC-ARC-ENC-1, SC-ARC-ENC-4, SC-ARC-ENC-6

A two-step flow. Step 1 collects the basic ledger settings; step 2 reveals
the generated recovery code and forces the user to acknowledge they have
saved it before letting them proceed.

## Step 1 — Settings

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel       New ledger                  Create  │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │  Name                                               │
 │  ┌───────────────────────────────────────────────┐  │
 │  │ e.g. Flatshare — Berlin                       │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Currency                                           │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  EUR — Euro            ▼                      │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │  Your display name                                  │
 │  ┌───────────────────────────────────────────────┐  │
 │  │ e.g. Stefan                                   │  │
 │  └───────────────────────────────────────────────┘  │
 │   This is how you'll appear to others in the        │
 │   ledger. You can change it later.                  │
 │                                                     │
 │  OneDrive folder                                    │
 │  ┌───────────────────────────────────────────────┐  │
 │  │ /Apps/SplitClone/flatshare-berlin/    [ Pick ]│  │
 │  └───────────────────────────────────────────────┘  │
 │   A new empty folder will be created here. Share    │
 │   it with the people in your group from OneDrive    │
 │   after you finish.                                 │
 │                                                     │
 │  ─────────────────────────────────────────────────  │
 │                                                     │
 │   🔒  All ledger contents are encrypted at rest in  │
 │       OneDrive. The next step shows your recovery   │
 │       code — save it.                               │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

- `Create` is disabled until Name, Display name, and Folder are all set.
- Currency picker shows the most-common 8 currencies followed by an "All
  currencies" submenu. Choice is permanent for the ledger (SC-FR-EXP-2).
- Folder picker calls Microsoft Graph's "select a folder" action; the
  default suggestion is `/Apps/SplitClone/<slugified-name>/`.
- The encryption notice at the bottom is informational only — encryption
  is mandatory and not toggleable (SC-ARC-ENC-1).

## Step 2 — Recovery code

Shown immediately after Create succeeds. Cannot be skipped without
acknowledgement. Backed by a `LedgerRenamed` + `ParticipantAdded` +
`ParticipantClaimed` initial event burst written to the first segment
already at this point — the ledger exists; the user is being told its
secret.

```
 ┌─────────────────────────────────────────────────────┐
 │              Save your recovery code                │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   ⚠  This code is the ONLY way to add new devices   │
 │       or to recover access if this device is lost.  │
 │       SplitClone has no servers and cannot reset    │
 │       it for you.                                   │
 │                                                     │
 │  ┌───────────────────────────────────────────────┐  │
 │  │                                               │  │
 │  │              ░ ░░░░ ░░ ░ ░░░░░░               │  │
 │  │              ░░  ░░░░ ░ ░░  ░  ░              │  │
 │  │              ░░░░  ░ ░░░░ ░░░░░░              │  │
 │  │              ░  ░░░ ░░  ░░░  ░░░              │  │   ← QR code
 │  │              ░░ ░░ ░░░ ░░░░ ░░ ░              │  │     (~200×200)
 │  │              ░░░░░░░░  ░░ ░░░ ░░              │  │
 │  │              ░ ░░  ░░ ░░░░░  ░░               │  │
 │  │                                               │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │     SC-1nYjF4kQ-8mPbD2Vt-7hRwL5xN-3aZcS9eK-uG7T     │
 │                                          [ Copy ]   │
 │                                                     │
 │  Save it in:                                        │
 │   [ 🔐 Password manager ]   [ 💾 Download .txt ]    │
 │   [ ✉  Send to myself     ]   [ 🖨 Print          ] │
 │                                                     │
 │  ─────────────────────────────────────────────────  │
 │                                                     │
 │   [✓] I have saved the recovery code in a safe      │
 │       place outside this device.                    │
 │                                                     │
 │                                          [ Done ]   │
 └─────────────────────────────────────────────────────┘
```

- `[ Done ]` is disabled until the acknowledgement checkbox is ticked.
- The base64url-with-checksum string is shown in a monospace block. Spacing
  every 8 characters with hyphens makes manual transcription possible if
  all other options fail.
- `Send to myself` opens the OS share sheet pre-filled with the code as
  email body; the user picks any of their accounts. No automatic mailing.
- `Print` triggers `window.print()` on a stripped-down stylesheet that
  shows ONLY the QR + code + a short instructional paragraph.

## Persistent reminder (if user dismisses without acknowledging)

Per SC-ARC-ENC-6, the prompt re-appears as a sticky banner on every screen
inside this ledger until acknowledged:

```
 │  ⚠  Save your recovery code        [ Show code ]    │
 │     for "Flatshare — Berlin"       [ Dismiss × ]    │
```

`Dismiss` is intentionally less prominent than `Show code`. Tapping
Dismiss snoozes the banner for 24 h but does not clear the underlying
"not acknowledged" flag.

## Interactions

| Gesture | Result |
| --- | --- |
| Tap Create (step 1) | Generate AES-256 key, generate device participant, write metadata + initial events, encrypt + upload first segment, advance to step 2. |
| Tap Copy (step 2) | Copy raw code (without spaces) to clipboard; toast confirms. |
| Tap Done (step 2) | Set `ledger.recoveryCodeAcknowledged = true` (local IndexedDB), navigate to expense list (screen 02). |
| Tap a "Save it in" button | Trigger the corresponding system flow; does NOT auto-acknowledge — the user still has to tick the box. |

## Notes for the implementer

- The acknowledgement flag is local-only: it lives in IndexedDB scoped to
  ledger UUID, not in the event log. A new device that imports the join
  code starts fresh and sees the same nag until acknowledged on that
  device.
- The QR encodes the same string shown below it. There is no second
  representation; consistency matters for the fingerprint check
  (SC-ARC-ENC-3).
- If the user closes the browser at step 2 without acknowledging, the
  ledger exists and is usable; only the nag persists. Data is never lost.
