/**
 * Phase 2 review aid: folds a hand-written scenario and prints the derived
 * state, balances and both export projections. Run with `pnpm play`.
 *
 * This is the human-readable counterpart to the spec suite — useful for
 * eyeballing that the domain behaves sensibly end to end.
 */
import {
	fold,
	balancesFor,
	listExpenses,
	participantName,
	formatMoney,
	project,
	makeEvent
} from '../src/lib/domain/index';
import type { EventKind, EventPayloads, LedgerEvent } from '../src/lib/domain/index';

let n = 0;
function ev<K extends EventKind>(kind: K, payload: EventPayloads[K]): LedgerEvent {
	n += 1;
	return makeEvent(kind, payload, {
		id: `evt-${String(n).padStart(3, '0')}`,
		schemaVersion: 1,
		authorDeviceId: 'dev-stefan',
		authorParticipantId: 'p-stefan',
		entryAt: `2026-05-14T10:00:${String(n).padStart(2, '0')}.000Z`
	});
}

const events: LedgerEvent[] = [
	ev('LedgerRenamed', { name: 'Flatshare — Berlin' }),
	ev('ParticipantAdded', { participantId: 'p-anna', name: 'Anna' }),
	ev('ParticipantAdded', { participantId: 'p-stefan', name: 'Stefan' }),
	ev('ParticipantAdded', { participantId: 'p-lukas', name: 'Lukas' }),
	ev('LabelCreated', { labelId: 'l-food', name: 'food' }),
	ev('LabelCreated', { labelId: 'l-shared', name: 'shared' }),
	ev('ExpenseCreated', {
		expenseId: 'e1',
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
		expenseId: 'e2',
		input: {
			title: 'Pizza Thursday',
			amount: 3200n,
			executionDate: '2026-05-15',
			payerId: 'p-stefan',
			splitParticipantIds: ['p-stefan', 'p-lukas'],
			labelIds: ['l-food']
		}
	}),
	ev('SettlementRecorded', {
		settlementId: 's1',
		input: {
			fromParticipantId: 'p-lukas',
			toParticipantId: 'p-anna',
			amount: 1573n,
			date: '2026-05-16'
		}
	})
];

const state = fold(events);
const line = (s = '') => console.log(s);

line(`Ledger: ${state.ledgerName}`);
line(`Participants: ${[...state.participants.values()].map((p) => p.name).join(', ')}`);
line();
line('Expenses (newest first):');
for (const e of listExpenses(state)) {
	line(`  ${e.executionDate}  ${e.title}  €${formatMoney(e.amount)}`);
	line(
		`     paid by ${participantName(state, e.payerId)}, split ${e.splitParticipantIds.length} ways`
	);
}

line();
line('Balances (each debt shown once, from the debtor):');
let anyDebt = false;
for (const p of state.participants.values()) {
	// Only the "p owes someone" direction, so each pair prints exactly once.
	for (const b of balancesFor(state, p.id)) {
		if (b.amount <= 0n) continue;
		anyDebt = true;
		line(`  ${p.name} owes ${participantName(state, b.participantId)} €${formatMoney(b.amount)}`);
	}
}
if (!anyDebt) line('  everyone is settled up');

for (const mode of ['cash', 'virtual'] as const) {
	line();
	line(`Export for Stefan — ${mode} basis:`);
	for (const r of project(state, 'p-stefan', mode)) {
		const sign = r.amount >= 0n ? '+' : '-';
		line(
			`  ${r.date}  ${r.description.padEnd(24)} ${sign}€${formatMoney(r.amount < 0n ? -r.amount : r.amount)}`
		);
	}
}
