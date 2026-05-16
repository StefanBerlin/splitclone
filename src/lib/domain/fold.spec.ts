import { describe, it, expect } from 'vitest';
import { fold } from './fold';
import { resolveLabelNames } from './selectors';
import type { LedgerEvent } from './types';
import { ev, instant } from './_testkit';

function baseLedger(): LedgerEvent[] {
	return [
		ev('LedgerRenamed', { name: 'Flatshare — Berlin' }),
		ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }),
		ev('ParticipantAdded', { participantId: 'p-stefan', name: 'Stefan' }),
		ev('LabelCreated', { labelId: 'l-food', name: 'food' })
	];
}

describe('fold is a deterministic merge (SC-ARC-MRG-1)', () => {
	it('produces the same state regardless of input order', () => {
		const events = [
			...baseLedger(),
			ev('ExpenseCreated', {
				expenseId: 'e1',
				input: {
					title: 'Dinner',
					amount: 3000n,
					executionDate: '2026-05-10',
					payerId: 'p-anna',
					splitParticipantIds: ['p-anna', 'p-stefan'],
					labelIds: ['l-food']
				}
			})
		];

		const forward = fold(events);
		const reversed = fold([...events].reverse());
		const shuffled = fold([events[2]!, events[0]!, events[4]!, events[1]!, events[3]!]);

		expect(reversed).toEqual(forward);
		expect(shuffled).toEqual(forward);
		expect(forward.ledgerName).toBe('Flatshare — Berlin');
		expect(forward.expenses.get('e1')?.amount).toBe(3000n);
		expect(forward.expenses.get('e1')?.createdBy).toBe('p-anna');
	});

	it('breaks equal-timestamp ties by event id, deterministically', () => {
		const mk = (id: string, name: string) =>
			ev('LedgerRenamed', { name }, { id, entryAt: instant(99) });
		// Same entryAt; id "evt-b" > "evt-a", so evt-b is applied last and wins.
		const a = fold([mk('evt-a', 'First'), mk('evt-b', 'Second')]);
		const b = fold([mk('evt-b', 'Second'), mk('evt-a', 'First')]);
		expect(a.ledgerName).toBe('Second');
		expect(b.ledgerName).toBe('Second');
	});
});

describe('last-write-wins on conflicting edits (SC-ARC-MRG-2)', () => {
	const create = ev('ExpenseCreated', {
		expenseId: 'e1',
		input: {
			title: 'Taxi',
			amount: 1000n,
			executionDate: '2026-05-10',
			payerId: 'p-anna',
			splitParticipantIds: ['p-anna', 'p-stefan'],
			labelIds: []
		}
	});

	it('the ExpenseUpdated with the later entryAt wins', () => {
		const early = ev(
			'ExpenseUpdated',
			{ expenseId: 'e1', input: { ...create.payload.input, title: 'Taxi (early edit)' } },
			{ id: 'u-early', entryAt: instant(20) }
		);
		const late = ev(
			'ExpenseUpdated',
			{ expenseId: 'e1', input: { ...create.payload.input, title: 'Taxi (late edit)' } },
			{ id: 'u-late', entryAt: instant(30) }
		);

		const state = fold([create, late, early]); // deliberately out of order
		const e = state.expenses.get('e1');
		expect(e?.title).toBe('Taxi (late edit)');
		expect(e?.lastEditedAt).toBe(instant(30));
	});

	it('a delete tombstone with a later timestamp beats a racing update', () => {
		const update = ev(
			'ExpenseUpdated',
			{ expenseId: 'e1', input: { ...create.payload.input, title: 'edited' } },
			{ id: 'u1', entryAt: instant(20) }
		);
		const del = ev('ExpenseDeleted', { expenseId: 'e1' }, { id: 'd1', entryAt: instant(30) });
		const state = fold([create, update, del]);
		expect(state.expenses.has('e1')).toBe(false);
	});

	it('an update applied after a tombstone is dropped (delete wins)', () => {
		const del = ev('ExpenseDeleted', { expenseId: 'e1' }, { id: 'd1', entryAt: instant(20) });
		const update = ev(
			'ExpenseUpdated',
			{ expenseId: 'e1', input: { ...create.payload.input, title: 'zombie' } },
			{ id: 'u1', entryAt: instant(30) }
		);
		expect(fold([create, del, update]).expenses.has('e1')).toBe(false);
	});
});

describe('tombstones and provenance', () => {
	it('LabelDeleted removes the label but the expense keeps its id (elided on read, SC-FR-LBL-4)', () => {
		const events: LedgerEvent[] = [
			...baseLedger(),
			ev('ExpenseCreated', {
				expenseId: 'e1',
				input: {
					title: 'Snacks',
					amount: 500n,
					executionDate: '2026-05-10',
					payerId: 'p-anna',
					splitParticipantIds: ['p-anna'],
					labelIds: ['l-food']
				}
			}),
			ev('LabelDeleted', { labelId: 'l-food' })
		];
		const state = fold(events);
		const e = state.expenses.get('e1')!;
		expect(e.labelIds).toEqual(['l-food']); // raw ref preserved in the event-derived expense
		expect(state.labels.has('l-food')).toBe(false); // label gone
		expect(resolveLabelNames(state, e)).toEqual([]); // dangling ref elided on read
	});

	it('participant rename keeps the id and claim state', () => {
		const state = fold([
			...baseLedger(),
			ev('ParticipantClaimed', { participantId: 'p-anna', deviceId: 'dev-1' }),
			ev('ParticipantRenamed', { participantId: 'p-anna', name: 'Anna B.' })
		]);
		const anna = state.participants.get('p-anna')!;
		expect(anna.name).toBe('Anna B.');
		expect(anna.claimedByDeviceId).toBe('dev-1');
	});
});
