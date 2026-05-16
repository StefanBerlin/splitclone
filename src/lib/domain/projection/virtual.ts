/**
 * Mode B — Virtual account / share basis (SC-FR-EXR-3). The subject P's net
 * position inside the shared ledger, for import into a virtual sub-account.
 *
 *  - Expense P is payer (share s, total T) -> +(T - s) on exec date;
 *                                             omitted when T == s (sole member)
 *  - Expense paid by other, P in split (s) -> -s on exec date
 *  - Expense paid by other, P not in split -> NOT exported
 *  - Settlement P paid amount A            -> +A
 *  - Settlement P received amount A        -> -A
 *
 * Sum over rows = P's net position; it goes negative exactly when P consumes a
 * share without having paid, and returns toward zero as settlements clear.
 */
import { participantName } from '../selectors';
import type { DerivedState, UUID } from '../types';
import type { ExportRow } from './types';
import { byDateThenId, expenseLabels, otherSplitNames, subjectShare } from './shared';

export function projectVirtual(state: DerivedState, subjectId: UUID): ExportRow[] {
	const rows: ExportRow[] = [];

	for (const e of state.expenses.values()) {
		const inSplit = e.splitParticipantIds.includes(subjectId);
		const isPayer = e.payerId === subjectId;
		if (!isPayer && !inSplit) continue; // P uninvolved

		const share = subjectShare(e, subjectId);

		if (isPayer) {
			const amount = e.amount - share; // lent to the rest of the group
			if (amount === 0n) continue; // sole participant: nothing to record
			rows.push({
				date: e.executionDate,
				description: e.title,
				amount,
				counterparties: otherSplitNames(state, e, subjectId),
				labels: expenseLabels(state, e),
				note: e.note,
				sourceId: e.id
			});
		} else {
			rows.push({
				date: e.executionDate,
				description: e.title,
				amount: -share, // P owes their share
				counterparties: [participantName(state, e.payerId)],
				labels: expenseLabels(state, e),
				note: e.note,
				sourceId: e.id
			});
		}
	}

	for (const s of state.settlements.values()) {
		if (s.fromParticipantId === subjectId) {
			rows.push({
				date: s.date,
				description: `Settlement to ${participantName(state, s.toParticipantId)}`,
				amount: s.amount, // paying down what P owed: credit to virtual acct
				counterparties: [participantName(state, s.toParticipantId)],
				labels: [],
				note: s.note,
				sourceId: s.id
			});
		} else if (s.toParticipantId === subjectId) {
			rows.push({
				date: s.date,
				description: `Settlement from ${participantName(state, s.fromParticipantId)}`,
				amount: -s.amount,
				counterparties: [participantName(state, s.fromParticipantId)],
				labels: [],
				note: s.note,
				sourceId: s.id
			});
		}
	}

	return byDateThenId(rows);
}
