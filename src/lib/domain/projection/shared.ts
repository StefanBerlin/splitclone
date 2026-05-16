import { resolveLabelNames, participantName } from '../selectors';
import { splitEqually } from '../splits';
import type { DerivedState, Expense, Money, UUID } from '../types';

/** The subject's equal-split share of an expense (0 if not in the split). */
export function subjectShare(expense: Expense, subjectId: UUID): Money {
	const shares = splitEqually({
		amount: expense.amount,
		splitParticipantIds: expense.splitParticipantIds,
		payerId: expense.payerId
	});
	return shares.get(subjectId) ?? 0n;
}

/** Names of every split participant other than the subject. */
export function otherSplitNames(state: DerivedState, expense: Expense, subjectId: UUID): string[] {
	return expense.splitParticipantIds
		.filter((id) => id !== subjectId)
		.map((id) => participantName(state, id));
}

export function expenseLabels(state: DerivedState, expense: Expense): string[] {
	return resolveLabelNames(state, expense);
}

/** Stable ordering for export rows: by date, then source id. */
export function byDateThenId<T extends { date: string; sourceId: string }>(rows: T[]): T[] {
	return [...rows].sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? -1 : 1;
		return a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0;
	});
}
