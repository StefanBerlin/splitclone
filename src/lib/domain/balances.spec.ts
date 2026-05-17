import { describe, it, expect } from 'vitest';
import { fold } from './fold';
import { pairwiseBalance, balancesFor } from './balances';
import type { LedgerEvent } from './types';
import { ev } from './_testkit';

// Anna, Stefan, Lukas. Ids chosen so sort order is anna < lukas < stefan.
function ledger(): LedgerEvent[] {
	return [
		ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }),
		ev('ParticipantAdded', { participantId: 'p-stefan', name: 'Stefan' }),
		ev('ParticipantAdded', { participantId: 'p-lukas', name: 'Lukas' }),
		// Anna pays 3000, split 3 ways equally -> 1000 each.
		ev('ExpenseCreated', {
			expenseId: 'e1',
			input: {
				title: 'Dinner',
				amount: 3000n,
				executionDate: '2026-05-01',
				payerId: 'p-anna',
				splitParticipantIds: ['p-anna', 'p-stefan', 'p-lukas'],
				labelIds: []
			}
		}),
		// Stefan pays 600, split Stefan+Lukas -> 300 each.
		ev('ExpenseCreated', {
			expenseId: 'e2',
			input: {
				title: 'Taxi',
				amount: 600n,
				executionDate: '2026-05-02',
				payerId: 'p-stefan',
				splitParticipantIds: ['p-stefan', 'p-lukas'],
				labelIds: []
			}
		}),
		// Stefan settles his 1000 debt to Anna.
		ev('SettlementRecorded', {
			settlementId: 's1',
			input: {
				fromParticipantId: 'p-stefan',
				toParticipantId: 'p-anna',
				amount: 1000n,
				date: '2026-05-03'
			}
		})
	];
}

describe('pairwise balances (SC-FR-BAL-1)', () => {
	const state = fold(ledger());

	it('debts arise from split shares owed to the payer', () => {
		// Lukas owes Anna his 1000 share from e1.
		expect(pairwiseBalance(state, 'p-lukas', 'p-anna')).toBe(1000n);
		// Lukas owes Stefan his 300 share from e2.
		expect(pairwiseBalance(state, 'p-lukas', 'p-stefan')).toBe(300n);
	});

	it('a settlement clears the settled direction', () => {
		// Stefan owed Anna 1000 (e1) then paid 1000 -> net zero.
		expect(pairwiseBalance(state, 'p-stefan', 'p-anna')).toBe(0n);
	});

	it('is antisymmetric: balance(a,b) === -balance(b,a)', () => {
		expect(pairwiseBalance(state, 'p-anna', 'p-lukas')).toBe(-1000n);
		expect(pairwiseBalance(state, 'p-stefan', 'p-lukas')).toBe(-300n);
	});

	it('a participant never owes themselves', () => {
		expect(pairwiseBalance(state, 'p-anna', 'p-anna')).toBe(0n);
	});
});

describe('per-participant summary (SC-FR-BAL-2)', () => {
	const state = fold(ledger());

	it("Anna's view: Lukas owes her 1000, Stefan settled (omitted)", () => {
		expect(balancesFor(state, 'p-anna')).toEqual([
			{ participantId: 'p-lukas', amount: -1000n } // negative = the other owes the subject
		]);
	});

	it("Lukas's view: he owes Anna 1000 and Stefan 300, sorted by id", () => {
		expect(balancesFor(state, 'p-lukas')).toEqual([
			{ participantId: 'p-anna', amount: 1000n },
			{ participantId: 'p-stefan', amount: 300n }
		]);
	});

	it('zero balances are omitted entirely', () => {
		const stefan = balancesFor(state, 'p-stefan');
		expect(stefan.find((e) => e.participantId === 'p-anna')).toBeUndefined();
		expect(stefan).toEqual([{ participantId: 'p-lukas', amount: -300n }]);
	});
});
