/** Read-side helpers over DerivedState. Pure. */
import type { DerivedState, Expense, UUID } from './types';

/** Participant display name, falling back to the raw id if unknown. */
export function participantName(state: DerivedState, id: UUID): string {
	return state.participants.get(id)?.name ?? id;
}

/**
 * Label names for an expense, eliding ids whose label has been deleted
 * (SC-FR-LBL-4). Order follows the expense's labelIds.
 */
export function resolveLabelNames(state: DerivedState, expense: Expense): string[] {
	const names: string[] = [];
	for (const id of expense.labelIds) {
		const label = state.labels.get(id);
		if (label) names.push(label.name);
	}
	return names;
}

/** Non-tombstoned expenses, newest execution-date first (createdAt breaks ties). */
export function listExpenses(state: DerivedState): Expense[] {
	return [...state.expenses.values()].sort((a, b) => {
		if (a.executionDate !== b.executionDate) {
			return a.executionDate < b.executionDate ? 1 : -1;
		}
		if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
		return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
	});
}
