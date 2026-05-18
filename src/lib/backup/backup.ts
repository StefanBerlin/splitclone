/**
 * Local backup / restore — pure serialise/parse layer (SRS Q9, SC-FR-BAK-*).
 *
 * This file owns the *backup file format* only. It does no I/O, no crypto and
 * no IndexedDB; the store ($lib/ui/stores/app) supplies already-decrypted
 * events and consumes the parsed result. Keeping it pure makes the format
 * exhaustively unit-testable and is why the round-trip test can run in node.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THE BACKUP IS DELIBERATELY UNENCRYPTED AND HUMAN-READABLE (SRS Q9 (a)).
 *  It contains every ledger's join code in clear text. Whoever holds the
 *  file can decrypt every ledger. Securing it is the USER's responsibility,
 *  not the app's — the UI states this at export time. This is an explicit,
 *  accepted exception to the at-rest encryption posture (SC-ARC-ENC-*).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The backup format is a NEW member of the file format (SC-ARC-FMT-1 item
 * (g)) on its OWN schema-version track (`splitcloneBackup`), independent of
 * the event-log schema version (`SCHEMA_VERSION`). Full field-by-field
 * documentation, the restore algorithm and the cross-version compatibility
 * contract live in docs/backup-format.md — keep that file in lockstep with
 * any change here (SC-ARC-FMT-3 governance).
 */
import { decodeEvent, encodeEvent } from '$lib/domain';
import type { LedgerEvent } from '$lib/domain';
import { APP_VERSION, SCHEMA_VERSION } from '$lib/meta';

/** Backup-file schema version. Independent of SCHEMA_VERSION (event log).
 *  Bump — with a docs/backup-format.md + CHANGELOG entry — only when this
 *  file's shape changes (SC-ARC-FMT-3). */
export const BACKUP_FORMAT_VERSION = 1 as const;

/** Pointer embedded in every file so a future maintainer holding only the
 *  backup can find the spec that documents it. */
export const BACKUP_FORMAT_DOC = 'docs/backup-format.md';

const WARNING =
	'UNENCRYPTED BACKUP. This file contains the join code (decryption key) of ' +
	'every ledger in clear text. Anyone who obtains this file can read all of ' +
	'them. Store it somewhere you trust. SplitClone never uploads this file.';

/** One ledger as it lives in the backup file. `events` are $bigint-tagged
 *  exactly as encodeEvent() emits (Money is a bigint and JSON has none — see
 *  docs/backup-format.md "Money encoding"). */
export interface BackupLedger {
	ledgerId: string;
	/** SC-ARC-ENC-4 join code. The clear-text key material (see warning). */
	joinCode: string;
	/** SC-ARC-ENC-3 fingerprint, for a defensive joinCode↔fingerprint check. */
	fingerprint: string;
	/** Private OneDrive sync hint (RootRef). Restored as-is so a recovered
	 *  ledger can reattach to its folder; opaque to this pure layer. */
	root?: unknown;
	recoveryAcknowledged: boolean;
	events: unknown[];
}

export interface BackupFile {
	/** Backup-format schema version. A reader MUST refuse a file whose value
	 *  exceeds the version it understands (see parseBackup). */
	splitcloneBackup: number;
	_warning: string;
	exportedAt: string;
	exportedByDeviceId: string;
	/** Provenance + the cross-version compatibility contract. Informational
	 *  fields never gate a restore by themselves; the gates are the two
	 *  version integers (see parseBackup / docs/backup-format.md). */
	compatibility: {
		backupFormatVersion: number;
		/** Event-log schema the `events` arrays are written in (SCHEMA_VERSION
		 *  at export time). A reader refuses if this exceeds its own. */
		eventSchemaVersion: number;
		writtenByAppVersion: string;
		/** Human note: which app builds can read this file. */
		readableByAppVersions: string;
		formatDoc: string;
	};
	ledgers: BackupLedger[];
}

export interface BuildBackupInput {
	exportedAt: string;
	exportedByDeviceId: string;
	ledgers: Array<{
		ledgerId: string;
		joinCode: string;
		fingerprint: string;
		root?: unknown;
		recoveryAcknowledged: boolean;
		events: readonly LedgerEvent[];
	}>;
}

/** Build the in-memory backup object. The caller serialises it (see
 *  serializeBackup). Events are round-tripped through the canonical codec so
 *  the file uses the exact same $bigint tagging as a real event-log segment —
 *  one source of truth for Money encoding. */
export function buildBackup(input: BuildBackupInput): BackupFile {
	return {
		splitcloneBackup: BACKUP_FORMAT_VERSION,
		_warning: WARNING,
		exportedAt: input.exportedAt,
		exportedByDeviceId: input.exportedByDeviceId,
		compatibility: {
			backupFormatVersion: BACKUP_FORMAT_VERSION,
			eventSchemaVersion: SCHEMA_VERSION,
			writtenByAppVersion: APP_VERSION,
			readableByAppVersions: `app builds whose backup-format support >= ${BACKUP_FORMAT_VERSION} and event-schema support >= ${SCHEMA_VERSION}`,
			formatDoc: BACKUP_FORMAT_DOC
		},
		ledgers: input.ledgers.map((l) => ({
			ledgerId: l.ledgerId,
			joinCode: l.joinCode,
			fingerprint: l.fingerprint,
			...(l.root !== undefined ? { root: l.root } : {}),
			recoveryAcknowledged: l.recoveryAcknowledged,
			// JSON.parse(encodeEvent(...)) yields a plain, $bigint-tagged object
			// (no bigint left), embeddable directly and still human-readable.
			events: l.events.map((e) => JSON.parse(encodeEvent(e)) as unknown)
		}))
	};
}

/** Pretty JSON so the file is genuinely human-readable (Q9 (a)). */
export function serializeBackup(file: BackupFile): string {
	return JSON.stringify(file, null, 2);
}

export interface ParsedLedger {
	ledgerId: string;
	joinCode: string;
	fingerprint: string;
	root?: unknown;
	recoveryAcknowledged: boolean;
	/** Revived + structurally validated via the canonical decoder. */
	events: LedgerEvent[];
}

export type ParseResult =
	| { ok: true; exportedAt: string; exportedByDeviceId: string; ledgers: ParsedLedger[] }
	| { ok: false; error: string };

function isObj(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Parse + validate a backup file. Refuses loudly (never "best effort") when:
 *  - it is not JSON / not a backup file,
 *  - it was written by a NEWER backup format than we understand
 *    (mirrors SC-ARC-FMT-2: a half-understanding reader can corrupt data),
 *  - its events use a NEWER event schema than we understand,
 *  - any event fails the canonical decoder.
 * Forward compatibility (older file, newer app) is supported: older backup
 * formats and older event schemas parse and fold normally.
 */
export function parseBackup(text: string): ParseResult {
	let root: unknown;
	try {
		root = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Not a valid JSON file.' };
	}
	if (!isObj(root) || typeof root.splitcloneBackup !== 'number') {
		return { ok: false, error: 'Not a SplitClone backup file.' };
	}
	if (root.splitcloneBackup > BACKUP_FORMAT_VERSION) {
		return {
			ok: false,
			error: `This backup was written by a newer version of SplitClone (backup format v${root.splitcloneBackup}; this app understands up to v${BACKUP_FORMAT_VERSION}). Update the app, then restore.`
		};
	}
	const compat = isObj(root.compatibility) ? root.compatibility : {};
	const evSchema = typeof compat.eventSchemaVersion === 'number' ? compat.eventSchemaVersion : 1;
	if (evSchema > SCHEMA_VERSION) {
		return {
			ok: false,
			error: `This backup's events use a newer data schema (v${evSchema}; this app understands up to v${SCHEMA_VERSION}). Update the app, then restore.`
		};
	}
	if (!Array.isArray(root.ledgers)) {
		return { ok: false, error: 'Backup file has no "ledgers" array.' };
	}

	const ledgers: ParsedLedger[] = [];
	for (let i = 0; i < root.ledgers.length; i++) {
		const l = root.ledgers[i];
		if (!isObj(l)) return { ok: false, error: `Ledger #${i + 1} is malformed.` };
		const { ledgerId, joinCode, fingerprint, recoveryAcknowledged, events } = l;
		if (
			typeof ledgerId !== 'string' ||
			typeof joinCode !== 'string' ||
			typeof fingerprint !== 'string' ||
			!Array.isArray(events)
		) {
			return { ok: false, error: `Ledger #${i + 1} is missing required fields.` };
		}
		const revived: LedgerEvent[] = [];
		for (let j = 0; j < events.length; j++) {
			try {
				// Re-use the canonical decoder: revives $bigint Money and applies
				// the same structural validation a real segment line gets.
				revived.push(decodeEvent(JSON.stringify(events[j])));
			} catch {
				return {
					ok: false,
					error: `Ledger ${ledgerId}: event #${j + 1} is corrupt or unrecognised.`
				};
			}
		}
		ledgers.push({
			ledgerId,
			joinCode,
			fingerprint,
			...(l.root !== undefined ? { root: l.root } : {}),
			recoveryAcknowledged: recoveryAcknowledged === true,
			events: revived
		});
	}

	return {
		ok: true,
		exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : '',
		exportedByDeviceId: typeof root.exportedByDeviceId === 'string' ? root.exportedByDeviceId : '',
		ledgers
	};
}

/** Merge helper: union by event id, preserving order (existing first, then
 *  new). The deterministic fold re-sorts globally, so order here only affects
 *  which duplicate is kept — and duplicates are byte-identical by id, so it
 *  does not matter. This is what makes re-importing the same backup a no-op
 *  (idempotent restore, Q9 (b) merge mode). */
export function dedupeById(
	existing: readonly LedgerEvent[],
	incoming: readonly LedgerEvent[]
): {
	merged: LedgerEvent[];
	added: LedgerEvent[];
} {
	const seen = new Set(existing.map((e) => e.id));
	const added: LedgerEvent[] = [];
	for (const e of incoming) {
		if (!seen.has(e.id)) {
			seen.add(e.id);
			added.push(e);
		}
	}
	return { merged: [...existing, ...added], added };
}
