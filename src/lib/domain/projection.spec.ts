import { describe, it, expect } from 'vitest';
import { fold } from './fold';
import { project } from './projection';
import { sumMoney } from './money';
import type { ExportRow } from './projection';
import type { LedgerEvent } from './types';
import { ev } from './_testkit';

const SUBJECT = 'p-stefan';

function scenario(): LedgerEvent[] {
	const e = (
		expenseId: string,
		title: string,
		amount: bigint,
		executionDate: string,
		payerId: string,
		splitParticipantIds: string[]
	): LedgerEvent =>
		ev('ExpenseCreated', {
			expenseId,
			input: { title, amount, executionDate, payerId, splitParticipantIds, labelIds: [] }
		});

	return [
		ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }),
		ev('ParticipantAdded', { participantId: 'p-stefan', name: 'Stefan' }),
		ev('ParticipantAdded', { participantId: 'p-lukas', name: 'Lukas' }),
		// e1: Anna pays 3000, split 3 ways (Stefan share 1000)
		e('e1', 'Dinner', 3000n, '2026-05-01', 'p-anna', ['p-anna', 'p-stefan', 'p-lukas']),
		// e2: Stefan pays 900, split Stefan+Lukas (share 450)
		e('e2', 'Hotel', 900n, '2026-05-02', 'p-stefan', ['p-stefan', 'p-lukas']),
		// e3: Stefan pays 500 for Lukas only (Stefan excluded from split)
		e('e3', 'Lukas ticket', 500n, '2026-05-03', 'p-stefan', ['p-lukas']),
		// e4: Anna pays 200, Stefan uninvolved
		e('e4', 'Anna+Lukas snack', 200n, '2026-05-04', 'p-anna', ['p-anna', 'p-lukas']),
		// e5: Stefan pays 100, sole participant (T == s)
		e('e5', 'Stefan solo coffee', 100n, '2026-05-05', 'p-stefan', ['p-stefan']),
		// s1: Stefan pays Anna 700
		ev('SettlementRecorded', {
			settlementId: 's1',
			input: {
				fromParticipantId: 'p-stefan',
				toParticipantId: 'p-anna',
				amount: 700n,
				date: '2026-05-06'
			}
		}),
		// s2: Lukas pays Stefan 300
		ev('SettlementRecorded', {
			settlementId: 's2',
			input: {
				fromParticipantId: 'p-lukas',
				toParticipantId: 'p-stefan',
				amount: 300n,
				date: '2026-05-07'
			}
		})
	];
}

function bySource(rows: ExportRow[]): Map<string, ExportRow> {
	return new Map(rows.map((r) => [r.sourceId, r]));
}

describe('Mode A — Cash basis (SC-FR-EXR-3)', () => {
	const rows = project(fold(scenario()), SUBJECT, 'cash');
	const r = bySource(rows);

	it('exports exactly the rows where real money moved for the subject', () => {
		expect(new Set(r.keys())).toEqual(new Set(['e2', 'e3', 'e5', 's1', 's2']));
	});

	it('expense paid by subject is a full-amount outflow', () => {
		expect(r.get('e2')!.amount).toBe(-900n);
		expect(r.get('e3')!.amount).toBe(-500n);
		expect(r.get('e5')!.amount).toBe(-100n);
	});

	it('expense paid by someone else (subject in split) is NOT exported', () => {
		expect(r.has('e1')).toBe(false);
	});

	it('expense the subject is uninvolved in is NOT exported', () => {
		expect(r.has('e4')).toBe(false);
	});

	it('settlement paid is an outflow, settlement received is an inflow', () => {
		expect(r.get('s1')!.amount).toBe(-700n);
		expect(r.get('s2')!.amount).toBe(300n);
	});

	it('counterparties name the other split members', () => {
		expect(r.get('e2')!.counterparties).toEqual(['Lukas']);
	});

	it('net cash position', () => {
		expect(sumMoney(rows.map((x) => x.amount))).toBe(-1900n);
	});
});

describe('Mode B — Virtual account (SC-FR-EXR-3)', () => {
	const rows = project(fold(scenario()), SUBJECT, 'virtual');
	const r = bySource(rows);

	it('exports every expense the subject is involved in, plus settlements', () => {
		expect(new Set(r.keys())).toEqual(new Set(['e1', 'e2', 'e3', 's1', 's2']));
	});

	it('paid-by-other + in-split is a negative share', () => {
		expect(r.get('e1')!.amount).toBe(-1000n);
	});

	it('subject is payer: row is amount minus own share (lent to the group)', () => {
		expect(r.get('e2')!.amount).toBe(450n); // 900 - 450
		expect(r.get('e3')!.amount).toBe(500n); // 500 - 0 (payer not in split)
	});

	it('subject as sole split participant is omitted (T == s)', () => {
		expect(r.has('e5')).toBe(false);
	});

	it('uninvolved expense is not exported', () => {
		expect(r.has('e4')).toBe(false);
	});

	it('settlement signs are inverted vs cash (debt movement, not cashflow)', () => {
		expect(r.get('s1')!.amount).toBe(700n);
		expect(r.get('s2')!.amount).toBe(-300n);
	});

	it('net virtual position', () => {
		expect(sumMoney(rows.map((x) => x.amount))).toBe(350n);
	});
});
