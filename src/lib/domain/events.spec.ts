import { describe, it, expect } from 'vitest';
import { encodeEvent, decodeEvent } from './events';
import { ev } from './_testkit';

describe('JSONL codec (SC-ARC-LOG-3)', () => {
	it('round-trips an expense event including bigint Money exactly', () => {
		const original = ev('ExpenseCreated', {
			expenseId: 'exp-1',
			input: {
				title: 'Groceries (REWE)',
				amount: 4720n,
				executionDate: '2026-05-14',
				payerId: 'p-anna',
				splitParticipantIds: ['p-anna', 'p-stefan', 'p-lukas'],
				labelIds: ['l-food'],
				note: 'weekly shop'
			}
		});

		const line = encodeEvent(original);
		expect(line).toContain('"$bigint":"4720"'); // Money tagged, not a float
		expect(line.includes('\n')).toBe(false); // one JSONL line

		const decoded = decodeEvent(line);
		expect(decoded).toEqual(original);
		expect(decoded.kind).toBe('ExpenseCreated');
		if (decoded.kind === 'ExpenseCreated') {
			expect(typeof decoded.payload.input.amount).toBe('bigint');
			expect(decoded.payload.input.amount).toBe(4720n);
		}
	});

	it('round-trips a settlement event', () => {
		const original = ev('SettlementRecorded', {
			settlementId: 's-1',
			input: {
				fromParticipantId: 'p-stefan',
				toParticipantId: 'p-anna',
				amount: 2460n,
				date: '2026-05-14'
			}
		});
		expect(decodeEvent(encodeEvent(original))).toEqual(original);
	});

	it('rejects corrupt or unrecognised lines', () => {
		expect(() => decodeEvent('not json')).toThrow();
		expect(() => decodeEvent('{"kind":"Nope","id":"x","entryAt":"t","payload":{}}')).toThrow();
		expect(() => decodeEvent('{"id":"x"}')).toThrow();
	});
});
