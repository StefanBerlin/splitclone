import { describe, it, expect } from 'vitest';
import {
	BACKUP_FORMAT_VERSION,
	buildBackup,
	dedupeById,
	parseBackup,
	serializeBackup
} from './backup';
import { ev } from '$lib/domain/_testkit';
import type { LedgerEvent } from '$lib/domain';
import { SCHEMA_VERSION } from '$lib/meta';

function sampleEvents(): LedgerEvent[] {
	return [
		ev('LedgerRenamed', { name: 'Trip' }),
		ev('ParticipantAdded', { participantId: 'p-a', name: 'Ann' }),
		ev('ExpenseCreated', {
			expenseId: 'e1',
			input: {
				title: 'Hotel',
				amount: 12345n, // bigint Money — must survive JSON round-trip
				executionDate: '2026-05-01',
				payerId: 'p-a',
				splitParticipantIds: ['p-a'],
				labelIds: []
			}
		})
	];
}

function backupText(events: LedgerEvent[]): string {
	return serializeBackup(
		buildBackup({
			exportedAt: '2026-05-17T00:00:00.000Z',
			exportedByDeviceId: 'dev-export',
			ledgers: [
				{
					ledgerId: 'led-1',
					joinCode: 'SC1.abc.dead',
					fingerprint: 'fp-1',
					root: { kind: 'own', ledgerId: 'led-1' },
					recoveryAcknowledged: true,
					events
				}
			]
		})
	);
}

describe('backup build/parse round-trip (SRS Q9, SC-FR-BAK-*)', () => {
	it('preserves every event incl. bigint Money exactly', () => {
		const events = sampleEvents();
		const res = parseBackup(backupText(events));
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.ledgers).toHaveLength(1);
		const got = res.ledgers[0]!;
		expect(got.ledgerId).toBe('led-1');
		expect(got.joinCode).toBe('SC1.abc.dead');
		expect(got.recoveryAcknowledged).toBe(true);
		expect(got.root).toEqual({ kind: 'own', ledgerId: 'led-1' });
		expect(got.events).toEqual(events);
		const exp = got.events.find((e) => e.kind === 'ExpenseCreated');
		// The Money field is a real bigint again, not a string/tag.
		expect(exp?.kind === 'ExpenseCreated' && exp.payload.input.amount).toBe(12345n);
	});

	it('is human-readable JSON carrying the warning + compatibility block', () => {
		const text = backupText(sampleEvents());
		expect(text).toContain('\n'); // pretty-printed
		const obj = JSON.parse(text);
		expect(obj.splitcloneBackup).toBe(BACKUP_FORMAT_VERSION);
		expect(obj._warning).toMatch(/UNENCRYPTED/);
		expect(obj.compatibility.eventSchemaVersion).toBe(SCHEMA_VERSION);
		expect(obj.compatibility.backupFormatVersion).toBe(BACKUP_FORMAT_VERSION);
		expect(obj.compatibility.formatDoc).toBe('docs/backup-format.md');
		expect(typeof obj.compatibility.writtenByAppVersion).toBe('string');
	});
});

describe('parseBackup refuses unsafe / unreadable input (loud, never best-effort)', () => {
	it('rejects non-JSON', () => {
		expect(parseBackup('not json')).toEqual({ ok: false, error: expect.any(String) });
	});

	it('rejects a file that is not a backup', () => {
		const r = parseBackup(JSON.stringify({ hello: 'world' }));
		expect(r.ok).toBe(false);
	});

	it('refuses a NEWER backup format version', () => {
		const r = parseBackup(
			JSON.stringify({ splitcloneBackup: BACKUP_FORMAT_VERSION + 1, ledgers: [] })
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/newer version/i);
	});

	it('refuses events from a NEWER event schema', () => {
		const r = parseBackup(
			JSON.stringify({
				splitcloneBackup: BACKUP_FORMAT_VERSION,
				compatibility: { eventSchemaVersion: SCHEMA_VERSION + 1 },
				ledgers: []
			})
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/newer data schema/i);
	});

	it('rejects a corrupt event rather than importing partial data', () => {
		const r = parseBackup(
			JSON.stringify({
				splitcloneBackup: BACKUP_FORMAT_VERSION,
				compatibility: { eventSchemaVersion: SCHEMA_VERSION },
				ledgers: [
					{
						ledgerId: 'led-x',
						joinCode: 'SC1.x.y',
						fingerprint: 'fp',
						recoveryAcknowledged: false,
						events: [{ not: 'an event' }]
					}
				]
			})
		);
		expect(r.ok).toBe(false);
	});

	it('accepts an OLDER/equal backup format (forward compatible)', () => {
		const r = parseBackup(backupText(sampleEvents()));
		expect(r.ok).toBe(true);
	});
});

describe('dedupeById — idempotent merge restore (Q9 (b))', () => {
	it('re-importing the same events adds nothing', () => {
		const events = sampleEvents();
		const { merged, added } = dedupeById(events, events);
		expect(added).toEqual([]);
		expect(merged).toEqual(events);
	});

	it('unions only genuinely new events, preserving existing', () => {
		const base = sampleEvents();
		const extra = ev('ParticipantAdded', { participantId: 'p-b', name: 'Bo' });
		const { merged, added } = dedupeById(base, [...base, extra]);
		expect(added).toEqual([extra]);
		expect(merged).toEqual([...base, extra]);
	});
});
