# 11 · Join ledger (paste / scan join code)

**Route:** `/ledger/join/`
**Requirements:** SC-FR-LED-2, SC-FR-PRT-2, SC-ARC-ENC-3, SC-ARC-ENC-4, SC-ARC-ENC-5

Two paths into the same place: scan a QR code shown on another device, or
paste a code that was sent via messenger. After the code is validated
against the ledger's key fingerprint (SC-ARC-ENC-3), the user is asked to
claim a participant identity (SC-FR-PRT-2).

## Step 1 — Method picker

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Cancel        Join a ledger                      │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Ask the ledger owner to show you their recovery   │
 │   code, then add it here.                           │
 │                                                     │
 │                                                     │
 │       ┌─────────────────────────────────────┐       │
 │       │                                     │       │
 │       │           📷  Scan QR code          │       │
 │       │                                     │       │
 │       └─────────────────────────────────────┘       │
 │                                                     │
 │       ┌─────────────────────────────────────┐       │
 │       │                                     │       │
 │       │         ⌨  Paste a code             │       │
 │       │                                     │       │
 │       └─────────────────────────────────────┘       │
 │                                                     │
 │  ─────────────────────────────────────────────────  │
 │                                                     │
 │   You'll also need to be added to the OneDrive      │
 │   folder by the ledger owner.  [ Learn how ]        │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

The "Learn how" link opens an in-app help sheet explaining the OneDrive
share-folder flow, since SplitClone cannot do this for the user.

## Step 2a — Scan QR

Full-bleed camera view with framing guides. The viewport stays full-screen
until either a code is detected or the user cancels.

```
 ┌─────────────────────────────────────────────────────┐
 │  × Cancel                                           │
 │                                                     │
 │                                                     │
 │            ┌─────────────────────────┐              │
 │            │ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │              │
 │            │                       │              │  ← framing guides
 │            │ │ live camera feed   │ │              │     animate while
 │            │                       │              │     scanning
 │            │ │ here               │ │              │
 │            │ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │              │
 │            └─────────────────────────┘              │
 │                                                     │
 │              Point at the QR code                   │
 │                                                     │
 │                                                     │
 │            [ ⌨  Type the code instead ]             │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

On successful scan → straight to Step 3 (validation).

If the device has no camera permission yet, the camera-permission
prompt is shown in-flow before the camera renders. If the user denies,
the screen falls back to Step 2b with an explanation banner.

## Step 2b — Paste code

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Back        Paste recovery code                  │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Paste the code your friend sent you.              │
 │                                                     │
 │  ┌───────────────────────────────────────────────┐  │
 │  │ SC-1nYjF4kQ-8mPbD2Vt-7hRwL5xN-3aZcS9eK-uG7T   │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │   Spaces and hyphens are ignored.                   │
 │                                                     │
 │                                       [ Continue ]  │
 │                                                     │
 └─────────────────────────────────────────────────────┘
```

`Continue` is disabled until the input parses as a well-formed code
(prefix + base64url + valid 4-char checksum, SC-ARC-ENC-4).

Invalid input states:

```
  Wrong checksum:
   │  ⚠  This code has a typo. Double-check the last  │
   │     four characters and the section in the middle.│

  Right shape, wrong ledger:
   │  ⚠  This code does not match the ledger at       │
   │     /Apps/SplitClone/flatshare-berlin/. Make     │
   │     sure you're joining the right folder.        │
```

The "right shape, wrong ledger" check happens once the user has also
picked the OneDrive folder (Step 3 below); we compare the code's
fingerprint against the metadata file's `keyFingerprint`
(SC-ARC-ENC-3).

## Step 3 — Pick the OneDrive folder

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Back        Choose the folder                    │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   Code accepted. Now point SplitClone at the        │
 │   shared OneDrive folder for this ledger.           │
 │                                                     │
 │  ┌───────────────────────────────────────────────┐  │
 │  │  /Apps/SplitClone/flatshare-berlin/  [ Pick ] │  │
 │  └───────────────────────────────────────────────┘  │
 │                                                     │
 │   Tip: this is the folder your friend shared with   │
 │   you. If you don't see it, check that you've       │
 │   accepted their share invite in OneDrive.          │
 │                                                     │
 │                                       [ Continue ]  │
 └─────────────────────────────────────────────────────┘
```

If the user pastes a code first and then tries to pick a folder whose
metadata has a different `keyFingerprint`, the inline error from Step 2b
is shown here.

## Step 4 — Claim participant identity (SC-FR-PRT-2)

```
 ┌─────────────────────────────────────────────────────┐
 │  ‹ Back        Who are you?                         │
 ├─────────────────────────────────────────────────────┤
 │                                                     │
 │   This ledger has these participants already:       │
 │                                                     │
 │   (•) Anna                                          │
 │   ( ) Stefan                                        │
 │   ( ) Lukas                                         │
 │                                                     │
 │   Or                                                │
 │                                                     │
 │   ( ) Add me as a new participant                   │
 │       ┌───────────────────────────────────────────┐ │
 │       │ Your name                                 │ │
 │       └───────────────────────────────────────────┘ │
 │                                                     │
 │                                          [ Join ]   │
 └─────────────────────────────────────────────────────┘
```

- Existing participants who are already claimed by another device are
  greyed out with a subtitle "Already claimed on someone else's device".
- The "Add me as new" option becomes the only choice if every existing
  participant is already claimed.

## Success state

Upon Join: navigate to the ledger's expense list (screen 02) and show a
top banner for ~5 seconds:

```
 │  ✓  Joined "Flatshare — Berlin". Welcome, Anna.    │
```

## Notes for the implementer

- The scanner module (`@zxing/browser` or equivalent) is loaded as a
  separate chunk so users who paste-only never pay the bundle cost.
- The fingerprint check happens once both code and folder are present;
  doing it earlier would require trusting the code's claim of which folder
  it belongs to.
- On Join completion: write `ParticipantClaimed` event into a brand-new
  segment under this device's UUID directory (SC-ARC-LOG-4).
- If the OneDrive folder lookup returns 403, surface the explanation in
  Step 3's error region: "Your friend has not given you access to this
  folder yet."
