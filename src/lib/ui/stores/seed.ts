/**
 * Phase 3 demo data. A single realistic ledger built from real domain events
 * so every screen exercises the actual fold/balance/projection code. Replaced
 * by IndexedDB-backed data in Phase 4.
 */
import { makeEvent } from '$lib/domain';
import type { EventKind, EventPayloads, LedgerEvent } from '$lib/domain';

export const DEMO_LEDGER_ID = 'led-flatshare';
export const DEMO_DEVICE_ID = 'dev-local';

let n = 0;
function ev<K extends EventKind>(kind: K, payload: EventPayloads[K]): LedgerEvent {
	n += 1;
	return makeEvent(kind, payload, {
		id: `seed-${String(n).padStart(3, '0')}`,
		schemaVersion: 1,
		authorDeviceId: DEMO_DEVICE_ID,
		authorParticipantId: 'p-stefan',
		entryAt: `2026-05-${String(10 + Math.floor(n / 6)).padStart(2, '0')}T0${n % 6}:0${n % 6}:00.000Z`
	});
}

export function seedEvents(): LedgerEvent[] {
	return [
		ev('LedgerRenamed', { name: 'Flatshare — Berlin' }),
		ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }),
		ev('ParticipantAdded', { participantId: 'p-stefan', name: 'Stefan' }),
		ev('ParticipantAdded', { participantId: 'p-lukas', name: 'Lukas' }),
		ev('ParticipantClaimed', { participantId: 'p-stefan', deviceId: DEMO_DEVICE_ID }),
		ev('LabelCreated', { labelId: 'l-food', name: 'food' }),
		ev('LabelCreated', { labelId: 'l-shared', name: 'shared' }),
		ev('LabelCreated', { labelId: 'l-travel', name: 'travel' }),
		ev('ExpenseCreated', {
			expenseId: 'e-grocery',
			input: {
				title: 'Groceries (REWE)',
				amount: 4720n,
				executionDate: '2026-05-14',
				payerId: 'p-anna',
				splitParticipantIds: ['p-anna', 'p-stefan', 'p-lukas'],
				labelIds: ['l-food', 'l-shared']
			}
		}),
		ev('ExpenseCreated', {
			expenseId: 'e-pizza',
			input: {
				title: 'Pizza Thursday',
				amount: 3200n,
				executionDate: '2026-05-14',
				payerId: 'p-stefan',
				splitParticipantIds: ['p-stefan', 'p-lukas'],
				labelIds: ['l-food'],
				note: 'Two large, one with extra cheese.'
			}
		}),
		ev('ExpenseCreated', {
			expenseId: 'e-cleaning',
			input: {
				title: 'Cleaning supplies',
				amount: 1895n,
				executionDate: '2026-05-12',
				payerId: 'p-stefan',
				splitParticipantIds: ['p-anna', 'p-stefan', 'p-lukas'],
				labelIds: ['l-shared']
			}
		}),
		ev('ExpenseCreated', {
			expenseId: 'e-train',
			input: {
				title: 'Train tickets to Potsdam',
				amount: 5400n,
				executionDate: '2026-05-09',
				payerId: 'p-anna',
				splitParticipantIds: ['p-anna', 'p-stefan'],
				labelIds: ['l-travel']
			}
		}),
		ev('SettlementRecorded', {
			settlementId: 's-lukas-anna',
			input: {
				fromParticipantId: 'p-lukas',
				toParticipantId: 'p-anna',
				amount: 1573n,
				date: '2026-05-13',
				note: 'Cash'
			}
		})
	];
}
