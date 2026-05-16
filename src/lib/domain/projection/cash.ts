/**
 * Mode A — Cash basis (SC-FR-EXR-3). Only real money movements involving the
 * subject participant P.
 *
 *  - Expense paid by P            -> outflow of the full amount on exec date
 *  - Expense paid by someone else -> NOT exported (no money moved for P)
 *  - Settlement P paid            -> outflow
 *  - Settlement P received        -> inflow
 */
import { participantName } from '../selectors';
import type { DerivedState, UUID } from '../types';
import type { ExportRow } from './types';
import { byDateThenId, expenseLabels, otherSplitNames } from './shared';

export function projectCash(state: DerivedState, subjectId: UUID): ExportRow[] {
	const rows: ExportRow[] = [];

	for (const e of state.expenses.values()) {
		if (e.payerId !== subjectId) continue; // only P's own outlays
		rows.push({
			date: e.executionDate,
			description: e.title,
			amount: -e.amount,
			counterparties: otherSplitNames(state, e, subjectId),
			labels: expenseLabels(state, e),
			note: e.note,
			sourceId: e.id
		});
	}

	for (const s of state.settlements.values()) {
		if (s.fromParticipantId === subjectId) {
			rows.push({
				date: s.date,
				description: `Settlement to ${participantName(state, s.toParticipantId)}`,
				amount: -s.amount,
				counterparties: [participantName(state, s.toParticipantId)],
				labels: [],
				note: s.note,
				sourceId: s.id
			});
		} else if (s.toParticipantId === subjectId) {
			rows.push({
				date: s.date,
				description: `Settlement from ${participantName(state, s.fromParticipantId)}`,
				amount: s.amount,
				counterparties: [participantName(state, s.fromParticipantId)],
				labels: [],
				note: s.note,
				sourceId: s.id
			});
		}
	}

	return byDateThenId(rows);
}
