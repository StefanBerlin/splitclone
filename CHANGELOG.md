# SplitClone — File Format Changelog

This file satisfies SC-ARC-FMT-3: it enumerates every on-disk/on-the-wire
schema version and the changes between them. "File format" is defined in
SC-ARC-FMT-1 (metadata file, segment layout/naming, encryption envelope,
JSONL event schema, join-code encoding, CSV export).

**Pre-v1.0 policy:** the format may still evolve. Each change is a deliberate
decision and is recorded here. The hard stability lock (SC-ARC-FMT-3 — any
change requires explicit project-owner approval) activates at the v1.0 release.
Post-v1.0, schema-version increments will be infrequent and batched.

## Schema version 1 (unreleased, in development)

The initial format. Still mutable while pre-v1.0; entries below track
notable shape changes during development so the eventual v1.0 freeze is
deliberate, not accidental.

- **Event types:** `LedgerRenamed`, `ParticipantAdded`, `ParticipantRenamed`,
  `ParticipantClaimed`, `LabelCreated`, `LabelRenamed`, `LabelDeleted`,
  `ExpenseCreated`, `ExpenseUpdated`, `ExpenseDeleted`, `SettlementRecorded`,
  `SettlementUpdated`, `SettlementDeleted`.
- **Money encoding:** tagged `{"$bigint":"<minor units>"}` in JSONL so it
  round-trips exactly (no floats).
- Event envelope: `id`, `kind`, `schemaVersion`, `authorDeviceId`,
  `authorParticipantId`, `entryAt`, `payload`.

### Change log within v1 (development)

- 2026-05-17 — **Multi-device participant claim.** A participant may now be
  claimed by several devices (one person on PC + phone), where before the
  most recent `ParticipantClaimed` silently won and the other device was
  pushed into creating a duplicate participant. The derived `Participant`
  now carries `claimedByDeviceIds: UUID[]` instead of a scalar
  `claimedByDeviceId`, and the `ParticipantClaimed` fold accumulates the
  device into a set while still removing it from any other participant (a
  device remains bound to exactly one participant — SC-FR-PRT-2). Approved
  by the project owner before implementation (recorded decision).
  **No schema-version bump.** None of SC-ARC-FMT-1 (a)–(f) change: the
  `ParticipantClaimed` payload is still exactly `{participantId, deviceId}`
  and no event type was added/removed. Only the in-memory fold
  interpretation and the derived-state shape change, and the derived state
  is explicitly _not_ part of the file format (SC-ARC-FMT-1). Migration on
  read: none required — historical single-claim logs fold forward
  unchanged (one claim → a 1-element set). Cross-version interaction: a
  not-yet-updated (old) device reading a ledger that now has a participant
  claimed by two devices degrades to the previous last-write-wins behaviour
  (it recognises only one of the devices) — no corruption, and a bump would
  be wrong here because SC-ARC-FMT-2 forbids implicit version increments
  and would needlessly lock every old device out of _all_ ledgers for an
  additive, backward-compatible behaviour change. SRS SC-FR-PRT-2 and
  SC-ARC-IDN-1 updated in lockstep (requirements.sdoc v0.13).

- 2026-05-17 — Finalised the CSV export format (SC-ARC-FMT-1 item (f),
  SC-FR-EXR-4). UTF-8; CRLF records with a trailing CRLF; RFC-4180 quoting
  (quote when a field has `"`, comma, CR or LF; inner quotes doubled);
  Amount a signed 2-fractional-digit decimal with `.` separator; Note
  CR/LF flattened to spaces. The fixed eight columns in order are: Date,
  Description, Amount, Currency, Counterparty, Labels, Note, ExpenseUUID.
  Currency is the constant EUR (MVP is single-currency, SC-FR-EXP-2; a
  per-ledger currency would be a separate deliberate format change).
  First precise definition within schema v1 (the Phase-3 writer was a
  placeholder), not a change to a shipped format → no version bump.
  Deliberate, recorded per the file-format governance rule. Not file
  format: the segment-size threshold was raised 4 KiB → 1 MiB
  (SC-ARC-LOG-5) — a tunable constant that does not affect
  interoperability (SRS Q2).

- 2026-05-17 — Defined the on-disk ledger folder layout (SC-ARC-FMT-1 items
  (a) + (b), SC-FR-LED-3, SC-ARC-LOG-4): a ledger folder contains a plaintext
  `ledger.json` (`ledgerId`, `schemaVersion`, `createdAt`, `encrypted:true`,
  `keyFingerprint` — and deliberately nothing sensitive) plus
  `events/<deviceId>/<openInstant>.jsonl.enc` sealed segment files. First
  definition within schema v1, not a change to a shipped format → no version
  bump. Not file format: the IndexedDB `remoteEtag`/`root` sync bookkeeping
  (private per-device cache, SC-ARC-FMT-1).
- 2026-05-17 — Defined the encrypted segment envelope (SC-ARC-FMT-1 item (c),
  SC-ARC-ENC-2): `[12-byte random IV ‖ AES-256-GCM ciphertext ‖ 16-byte tag]`,
  one fresh IV per seal. Also fixed the join-code encoding (SC-ARC-FMT-1 item
  (e), SC-ARC-ENC-4): `SC1.<base64url(32-byte key)>.<4-hex SHA-256 checksum>`.
  These are first definitions within schema v1, not changes to a shipped
  format, so no version bump. Not file format: IndexedDB now stores the sealed
  envelope rather than plaintext — local cache layout is private per
  SC-ARC-FMT-1 and excluded from the format.
- 2026-05-14 — Added `SettlementUpdated` event so settlements can be edited
  with the same semantics, audit trail (`lastEditedAt`/`lastEditedBy`) and
  last-write-wins/tombstone behaviour as expenses. Reason: the expense list
  shows settlements and users edit them in place. Deliberate pre-v1.0 format
  change; SRS SC-ARC-LOG-2 updated in lockstep (requirements.sdoc v0.11).
