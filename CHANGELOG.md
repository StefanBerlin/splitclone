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
