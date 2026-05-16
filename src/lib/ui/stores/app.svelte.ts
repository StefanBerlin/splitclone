/**
 * Phase 3 in-memory application store. Holds one event log per ledger and
 * folds on demand. Real domain code; no persistence/network yet. Phases 4–7
 * replace the guts of `dispatch`/`derived` with the segment store + sync
 * engine, keeping this façade stable for the UI.
 */
import { fold, makeEvent } from '$lib/domain';
import type { DerivedState, EventKind, EventPayloads, LedgerEvent, UUID } from '$lib/domain';
import { DEMO_DEVICE_ID, DEMO_LEDGER_ID, seedEvents } from './seed';

export interface LedgerSummary {
	id: UUID;
	name: string;
	participantCount: number;
	lastActivity?: string;
}

class AppStore {
	readonly deviceId = DEMO_DEVICE_ID;
	private logs = $state<Record<UUID, LedgerEvent[]>>({
		[DEMO_LEDGER_ID]: seedEvents()
	});

	/** Folded state for one ledger. Reactive: reads the $state log. */
	derived(ledgerId: UUID): DerivedState {
		return fold(this.logs[ledgerId] ?? []);
	}

	hasLedger(ledgerId: UUID): boolean {
		return ledgerId in this.logs;
	}

	list(): LedgerSummary[] {
		return Object.entries(this.logs).map(([id, events]) => {
			const s = fold(events);
			let lastActivity: string | undefined;
			for (const e of events) {
				if (!lastActivity || e.entryAt > lastActivity) lastActivity = e.entryAt;
			}
			return {
				id,
				name: s.ledgerName || 'Untitled ledger',
				participantCount: s.participants.size,
				lastActivity
			};
		});
	}

	/** The participant this device has claimed in a given ledger, if any. */
	claimedParticipantId(ledgerId: UUID): UUID | undefined {
		const s = this.derived(ledgerId);
		for (const p of s.participants.values()) {
			if (p.claimedByDeviceId === this.deviceId) return p.id;
		}
		return undefined;
	}

	dispatch<K extends EventKind>(ledgerId: UUID, kind: K, payload: EventPayloads[K]): void {
		const author = this.claimedParticipantId(ledgerId) ?? 'p-unknown';
		const event = makeEvent(kind, payload, {
			id: crypto.randomUUID(),
			schemaVersion: 1,
			authorDeviceId: this.deviceId,
			authorParticipantId: author,
			entryAt: new Date().toISOString()
		});
		// Replace the array so the $state proxy notices the change.
		this.logs[ledgerId] = [...(this.logs[ledgerId] ?? []), event];
	}

	/** Local-only forget: drops the in-memory log. No remote deletion. */
	removeLedger(ledgerId: UUID): void {
		const next: Record<UUID, LedgerEvent[]> = {};
		for (const [id, events] of Object.entries(this.logs)) {
			if (id !== ledgerId) next[id] = events;
		}
		this.logs = next;
	}

	createLedger(name: string, yourName: string): UUID {
		const id = `led-${crypto.randomUUID().slice(0, 8)}`;
		const participantId = `p-${crypto.randomUUID().slice(0, 8)}`;
		this.logs[id] = [];
		this.dispatch(id, 'LedgerRenamed', { name });
		this.dispatch(id, 'ParticipantAdded', { participantId, name: yourName });
		this.dispatch(id, 'ParticipantClaimed', {
			participantId,
			deviceId: this.deviceId
		});
		return id;
	}
}

export const app = new AppStore();
