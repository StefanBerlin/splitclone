/**
 * Deterministic merge (SC-ARC-MRG-1, SC-ARC-MRG-2).
 *
 * Events are totally ordered by (entryAt, id). Because event ids are unique,
 * this is a total order, so the folded state is identical on every device
 * regardless of the order events arrived in or sort-algorithm stability.
 *
 * Last-write-wins for conflicting ExpenseUpdated falls out for free: the event
 * with the later entryAt is simply applied last (SC-ARC-MRG-2). Tombstones win
 * over a racing update with an earlier timestamp.
 */
import type { DerivedState, LedgerEvent } from './types';

export function emptyState(): DerivedState {
	return {
		ledgerName: '',
		participants: new Map(),
		labels: new Map(),
		expenses: new Map(),
		settlements: new Map()
	};
}

export function compareEvents(a: LedgerEvent, b: LedgerEvent): number {
	if (a.entryAt < b.entryAt) return -1;
	if (a.entryAt > b.entryAt) return 1;
	if (a.id < b.id) return -1;
	if (a.id > b.id) return 1;
	return 0;
}

function apply(state: DerivedState, ev: LedgerEvent): DerivedState {
	switch (ev.kind) {
		case 'LedgerRenamed':
			state.ledgerName = ev.payload.name;
			return state;

		case 'ParticipantAdded':
			state.participants.set(ev.payload.participantId, {
				id: ev.payload.participantId,
				name: ev.payload.name,
				claimedByDeviceIds: []
			});
			return state;

		case 'ParticipantRenamed': {
			const p = state.participants.get(ev.payload.participantId);
			if (p) p.name = ev.payload.name;
			return state;
		}

		case 'ParticipantClaimed': {
			const target = state.participants.get(ev.payload.participantId);
			if (!target) return state;
			// A device is bound to exactly one participant (SC-FR-PRT-2): drop
			// this device from anyone else first, so re-claiming moves it
			// rather than leaving a stale binding. Co-devices on the old
			// participant are untouched — only this device migrates.
			const dev = ev.payload.deviceId;
			for (const p of state.participants.values()) {
				if (p !== target && p.claimedByDeviceIds.includes(dev)) {
					p.claimedByDeviceIds = p.claimedByDeviceIds.filter((d) => d !== dev);
				}
			}
			// Accumulate (idempotent): a person on PC + phone claims the same
			// participant from each, so multiple devices coexist here.
			if (!target.claimedByDeviceIds.includes(dev)) target.claimedByDeviceIds.push(dev);
			return state;
		}

		case 'LabelCreated':
			state.labels.set(ev.payload.labelId, {
				id: ev.payload.labelId,
				name: ev.payload.name
			});
			return state;

		case 'LabelRenamed': {
			const l = state.labels.get(ev.payload.labelId);
			if (l) l.name = ev.payload.name;
			return state;
		}

		case 'LabelDeleted':
			// Tombstone. Expense.labelIds may still reference this id; the
			// dangling ref is elided at read time (SC-FR-LBL-4), not here.
			state.labels.delete(ev.payload.labelId);
			return state;

		case 'ExpenseCreated':
			state.expenses.set(ev.payload.expenseId, {
				...ev.payload.input,
				id: ev.payload.expenseId,
				createdAt: ev.entryAt,
				createdBy: ev.authorParticipantId
			});
			return state;

		case 'ExpenseUpdated': {
			const existing = state.expenses.get(ev.payload.expenseId);
			// An update to a missing/deleted expense is dropped: a tombstone
			// with an earlier timestamp still wins (sorted application order).
			if (!existing) return state;
			state.expenses.set(ev.payload.expenseId, {
				...existing,
				...ev.payload.input,
				lastEditedAt: ev.entryAt,
				lastEditedBy: ev.authorParticipantId
			});
			return state;
		}

		case 'ExpenseDeleted':
			state.expenses.delete(ev.payload.expenseId);
			return state;

		case 'SettlementRecorded':
			state.settlements.set(ev.payload.settlementId, {
				...ev.payload.input,
				id: ev.payload.settlementId,
				createdAt: ev.entryAt,
				createdBy: ev.authorParticipantId
			});
			return state;

		case 'SettlementUpdated': {
			const existing = state.settlements.get(ev.payload.settlementId);
			// Same rule as ExpenseUpdated: dropped if the settlement is
			// missing/tombstoned (a delete with an earlier ts still wins).
			if (!existing) return state;
			state.settlements.set(ev.payload.settlementId, {
				...existing,
				...ev.payload.input,
				lastEditedAt: ev.entryAt,
				lastEditedBy: ev.authorParticipantId
			});
			return state;
		}

		case 'SettlementDeleted':
			state.settlements.delete(ev.payload.settlementId);
			return state;
	}
}

export function fold(events: readonly LedgerEvent[]): DerivedState {
	const ordered = [...events].sort(compareEvents);
	return ordered.reduce(apply, emptyState());
}
