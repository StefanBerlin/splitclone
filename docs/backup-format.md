# SplitClone Backup Format

**Status:** v1 (in development, pre-1.0). Implements SRS Q9 / `SC-FR-BAK-*`.
**Format member:** `SC-ARC-FMT-1` item (g). Governed by `SC-ARC-FMT-3`.
**Source of truth for behaviour:** [`src/lib/backup/backup.ts`](../src/lib/backup/backup.ts)
(pure build/parse) and `AppStore.exportBackup` / `previewBackup` /
`importBackup` in [`src/lib/ui/stores/app.svelte.ts`](../src/lib/ui/stores/app.svelte.ts).

This document is written so that **a future maintainer holding nothing but a
backup file and this page can fully understand and, if necessary, restore the
data by hand** — even many app versions later, or if the in-app restore is
broken. Keep it in lockstep with any format change (that is the
`SC-ARC-FMT-3` rule).

---

## 1. What a backup is (and is not)

A backup is a **single JSON file** containing the entire local application
database needed to reconstruct SplitClone on another device:

- every ledger's **full event log** (the complete, authoritative history —
  fold these to get all expenses, settlements, participants, labels, names),
- each ledger's **join code** (the 256-bit data key in transportable form),
- each ledger's **key fingerprint** and optional OneDrive **sync hint**,
- each ledger's **recovery-acknowledged** flag.

It is **not** the CSV export (`SC-FR-EXR-*`) — that is an accounting report
for humans/spreadsheets and is lossy. The backup is lossless and is the
disaster-recovery / device-migration artefact.

### ⚠ Security model (explicit, accepted exception — SRS Q9 (a))

The backup is **deliberately unencrypted and human-readable**. It contains
every ledger's join code **in clear text**. Anyone who obtains the file can
decrypt and read every ledger in it. This is an intentional exception to the
at-rest encryption posture (`SC-ARC-ENC-*`). **Securing the file is the
user's responsibility, not the app's.** The export UI states this and
requires an explicit acknowledgement before the file is produced; the file
itself repeats the warning in its `_warning` field. SplitClone never uploads
the backup anywhere.

---

## 2. Versioning and compatibility contract

Two **independent** integer version axes gate a restore. A reader must
**refuse loudly** (never partial / best-effort) if either exceeds what it
understands; older values are always accepted (forward compatible).

| Axis | Field | Meaning | Refuse-if |
| --- | --- | --- | --- |
| Backup-format version | `splitcloneBackup` and `compatibility.backupFormatVersion` | Shape of *this file* | file value > app's `BACKUP_FORMAT_VERSION` |
| Event-schema version | `compatibility.eventSchemaVersion` | Schema the `events[]` are written in (= `SCHEMA_VERSION` at export time, see CHANGELOG.md) | file value > app's `SCHEMA_VERSION` |

`compatibility.writtenByAppVersion` and `readableByAppVersions` are
**informational provenance only** — they never gate a restore by themselves.
The two integers above are the contract. This separation is deliberate: the
event log can evolve (its own CHANGELOG track) without re-versioning the
backup envelope, and vice versa.

Rule of thumb for a future maintainer: **a backup is restorable by any app
build whose `BACKUP_FORMAT_VERSION ≥` the file's `splitcloneBackup` and whose
`SCHEMA_VERSION ≥` the file's `compatibility.eventSchemaVersion`.** If you
have moved far ahead and the app refuses an old file, that is by design —
the fix is a migration step in the app, not loosening the check.

### Current version: backup format **1**, event schema **1**

---

## 3. File schema (v1)

```jsonc
{
  "splitcloneBackup": 1,                 // backup-format version (gate)
  "_warning": "UNENCRYPTED BACKUP. …",   // human warning, free text
  "exportedAt": "2026-05-17T22:00:00.000Z",   // ISO instant, informational
  "exportedByDeviceId": "dev-…",         // provenance only; NOT restored
  "compatibility": {
    "backupFormatVersion": 1,            // == splitcloneBackup (gate)
    "eventSchemaVersion": 1,             // == SCHEMA_VERSION of events (gate)
    "writtenByAppVersion": "0.1.0",      // informational
    "readableByAppVersions": "app builds whose backup-format support >= 1 and event-schema support >= 1",
    "formatDoc": "docs/backup-format.md" // pointer back to this file
  },
  "ledgers": [
    {
      "ledgerId": "led-abcd1234",
      "joinCode": "SC1.<base64url-32-bytes>.<4-hex-crc>",  // ⚠ the key, in clear
      "fingerprint": "<32 lowercase hex>",                  // SC-ARC-ENC-3
      "root": { "kind": "own", "ledgerId": "led-abcd1234" },// optional sync hint
      "recoveryAcknowledged": true,
      "events": [ /* LedgerEvent objects, $bigint-tagged — see §4 */ ]
    }
  ]
}
```

### Field reference

- **`splitcloneBackup`** (number, required) — backup-format version. Reader
  refuses if greater than its own `BACKUP_FORMAT_VERSION`.
- **`_warning`** (string) — human-facing security notice. Not parsed; present
  so the danger is obvious to anyone who opens the raw file.
- **`exportedAt`** (string) — ISO-8601 instant the file was written.
  Informational (shown in restore preview).
- **`exportedByDeviceId`** (string) — the device that produced the backup.
  **Provenance only. Never restored** — see §5 (device identity).
- **`compatibility`** (object) — the version contract (see §2). `formatDoc`
  points here so the spec is discoverable from the file alone.
- **`ledgers[]`** (array, required) — one entry per backed-up ledger:
  - **`ledgerId`** (string) — stable ledger id; also the IndexedDB key.
  - **`joinCode`** (string) — `SC1.<base64url(raw 32-byte AES-256 key)>.<4
    hex chars of SHA-256(key)>` (`SC-ARC-ENC-4`). This *is* the decryption
    key in transportable form. The non-extractable `CryptoKey` is **not**
    stored (cannot be); it is rebuilt from this on restore.
  - **`fingerprint`** (string) — 32 lowercase hex chars = first 16 bytes of
    SHA-256(raw key) (`SC-ARC-ENC-3`). Used for a defensive
    join-code↔fingerprint integrity check on restore.
  - **`root`** (object, optional) — private OneDrive sync hint (`RootRef`:
    `{kind:'own',ledgerId}` or `{kind:'shared',driveId,itemId}`). Restored
    as-is so a recovered ledger can reattach to its folder; absent if the
    ledger was never synced.
  - **`recoveryAcknowledged`** (boolean) — whether the user had dismissed
    the save-your-recovery-code prompt (`SC-ARC-ENC-6`).
  - **`events[]`** — the full event log; each element is one `LedgerEvent`
    envelope (see §4). Order is not significant: the deterministic fold
    (`SC-ARC-MRG-1`) re-sorts by `(entryAt, id)`.

---

## 4. Event encoding (Money / `$bigint`)

Events are emitted through the **same canonical codec as a real event-log
segment** (`encodeEvent` / `decodeEvent`, [`src/lib/domain/events.ts`](../src/lib/domain/events.ts)),
so the backup's event objects are byte-for-byte the JSONL event schema, just
embedded as nested JSON instead of newline-delimited strings.

Money is a `bigint` in minor units (euro cents) and JSON has no bigint, so a
Money value is encoded as a tagged object:

```json
{ "$bigint": "12345" }    // = 12345n = €123.45
```

A hand restore must revive every `{"$bigint":"…"}` back to an integer.
Each event envelope has: `id`, `kind`, `schemaVersion`, `authorDeviceId`,
`authorParticipantId`, `entryAt`, `payload`. Full per-kind payload schemas
are in the SRS (`SC-ARC-LOG-2`) and `src/lib/domain/types.ts`.

---

## 5. Restore algorithm (what the app does, and what to do by hand)

Two modes (SRS Q9 (b), both offered):

- **merge** — union the selected ledgers into existing state.
- **replace** — wipe the whole local DB first, then restore the selected
  ledgers (clean device migration).

Per-ledger steps (see `AppStore.importBackup`):

1. `parseBackup` — JSON-parse, gate both version axes (§2), and re-validate
   **every** event through `decodeEvent`. Any failure aborts the whole
   restore (no partial writes).
2. `decodeJoinCode(joinCode)` → raw 32-byte key. Compute
   `dataKeyFingerprint(raw)`; if it does not equal the stored `fingerprint`,
   skip that ledger (corrupt/tampered) — never import mismatched material.
3. **merge only:** if a ledger with the same `ledgerId` already exists with a
   *different* fingerprint → **skip, never overwrite** (key conflict; relates
   to `SC-ARC-LOG-1`). Same fingerprint → proceed (idempotent).
4. Compute events to write: merge = those whose `id` is not already present
   (`dedupeById`); replace = all (DB was wiped). This makes **re-importing
   the same backup a no-op**.
5. `importDataKey(raw)` → non-extractable `CryptoKey`; `keyPut` the
   `KeyRecord` (`ledgerId`, key, fingerprint, joinCode, root).
6. Re-seal the to-write events into this device's segment via `appendEvent`
   (each event keeps its original `authorDeviceId` inside the envelope; only
   the *segment folder* is this device's).
7. Register the ledger, union `recoveryAcknowledged`, refold from storage.

### Device identity (SRS Q9 decision 3 — important)

The restoring device **keeps its own `deviceId`** and **never adopts the
backup's** `exportedByDeviceId`. Rationale: `SC-ARC-LOG-1` sole-writer — two
physical devices sharing a device id would corrupt each other's append-only
segment chains. Restored events keep their original authorship in history
(valid, read-only past); new edits append under the restoring device's id.
After a restore the user **re-claims their participant** per ledger via the
normal multi-device claim flow (`SC-FR-PRT-2 (c)`). In `replace` mode the
DB wipe is followed by re-persisting the *current* device id, not the file's.

### Manual / emergency restore (no working app)

If the in-app restore is broken or no compatible build exists:

1. Check `splitcloneBackup` and `compatibility.eventSchemaVersion` against
   the app/spec you have — if the file is newer, you need a newer app or a
   migration; do not hand-edit events blindly.
2. For each ledger: the `joinCode` decrypts it. A future SplitClone "Join
   with a code" flow can re-adopt a ledger from its synced OneDrive folder
   using just the `joinCode` — that is the fastest non-developer path if the
   ledger was synced.
3. To reconstruct state offline: fold `events[]` with the deterministic merge
   (sort by `(entryAt, id)`, apply per `SC-ARC-LOG-2` / `fold.ts`), reviving
   every `{"$bigint":"…"}` to an integer (minor units). The result is the
   complete ledger; `joinCode` lets you re-encrypt it into the app's storage.

---

## 6. Edge cases

- **Ledger without a key on this device** — omitted from export (cannot be
  restored without its key); the export UI reports the count.
- **Idempotent re-import** — guaranteed by step 4 + the deterministic fold;
  importing the same file twice changes nothing.
- **Corrupt/tampered file** — rejected at parse (§5 step 1) before any write.
- **Newer file on an older app** — refused loudly with an explainer telling
  the user to update; this is intentional (`SC-ARC-FMT-2` analogue).
- **OAuth tokens are NOT in the backup** — by design (security). After a
  restore, reconnect OneDrive; synced ledgers reattach via their `root`.

---

## 7. Change log for this format

Every change to this file's shape requires bumping `BACKUP_FORMAT_VERSION`,
an entry here, and an entry in the top-level `CHANGELOG.md` "Backup format"
track (`SC-ARC-FMT-3`).

- **v1 (in development, 2026-05-17)** — initial format: `splitcloneBackup`,
  `_warning`, `exportedAt`, `exportedByDeviceId`, `compatibility{…}`,
  `ledgers[]{ ledgerId, joinCode, fingerprint, root?, recoveryAcknowledged,
  events[] }`. Events use event-schema v1 with `$bigint` Money tagging.
  Restore: merge + replace; restoring device keeps its own identity.
