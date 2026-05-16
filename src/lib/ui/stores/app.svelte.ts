/**
 * Application store façade. The UI reads a synchronous in-memory cache (the
 * `$state` logs) and writes through it; persistence to IndexedDB segments
 * happens asynchronously underneath, keeping the API the 12 screens use
 * unchanged from Phase 3.
 *
 * Phase 4: IndexedDB-backed segment store + device identity. Phase 5 seals
 * segments; Phases 6–7 add the OneDrive provider + sync engine behind the
 * same façade.
 */
import { fold, makeEvent } from '$lib/domain';
import type { DerivedState, EventKind, EventPayloads, LedgerEvent, UUID } from '$lib/domain';
import { getDeviceId } from '$lib/platform/device-id';
import { metaGet, metaSet } from '$lib/storage/indexed-db';
import { appendEvent, deleteLedgerSegments, loadLedgerEvents } from '$lib/storage/segment-store';
import { DEMO_LEDGER_ID, seedEvents } from './seed';

export interface LedgerSummary {
	id: UUID;
	name: string;
	participantCount: number;
	lastActivity?: string;
}

const LEDGERS_KEY = 'ledgers';

class AppStore {
	private logs = $state<Record<UUID, LedgerEvent[]>>({});
	private _ready = $state(false);
	private _deviceId = $state('');
	/** Per-ledger serialised write chain: segment append is read-modify-write,
	 *  so concurrent dispatches must not overlap. */
	private writeChain: Record<UUID, Promise<void>> = {};

	constructor() {
		void this.init();
	}

	get ready(): boolean {
		return this._ready;
	}
	get deviceId(): string {
		return this._deviceId;
	}

	private async init(): Promise<void> {
		try {
			this._deviceId = await getDeviceId();
			let ids = (await metaGet<UUID[]>(LEDGERS_KEY)) ?? [];

			if (ids.length === 0) {
				// First run on this device: seed a demo ledger and persist it so
				// it survives a reload (the whole point of Phase 4).
				const seeded = this.normaliseSeed(seedEvents(), this._deviceId);
				for (const ev of seeded) {
					await appendEvent(DEMO_LEDGER_ID, this._deviceId, ev);
				}
				ids = [DEMO_LEDGER_ID];
				await metaSet(LEDGERS_KEY, ids);
			}

			const loaded: Record<UUID, LedgerEvent[]> = {};
			await Promise.all(
				ids.map(async (id) => {
					loaded[id] = await loadLedgerEvents(id);
				})
			);
			this.logs = loaded;
		} catch (err) {
			console.error('[app] init failed; running with empty in-memory state', err);
		} finally {
			this._ready = true;
		}
	}

	/** Re-author seed events onto this device so claim detection works. */
	private normaliseSeed(events: LedgerEvent[], deviceId: string): LedgerEvent[] {
		return events.map((ev) => {
			if (ev.kind === 'ParticipantClaimed') {
				return { ...ev, authorDeviceId: deviceId, payload: { ...ev.payload, deviceId } };
			}
			return { ...ev, authorDeviceId: deviceId };
		});
	}

	private persist(ledgerId: UUID, event: LedgerEvent): void {
		this.writeChain[ledgerId] = (this.writeChain[ledgerId] ?? Promise.resolve())
			.then(() => appendEvent(ledgerId, this._deviceId, event))
			.catch((err) => console.error('[app] segment append failed', err));
	}

	private async registerLedger(id: UUID): Promise<void> {
		const ids = (await metaGet<UUID[]>(LEDGERS_KEY)) ?? [];
		if (!ids.includes(id)) await metaSet(LEDGERS_KEY, [...ids, id]);
	}

	private async unregisterLedger(id: UUID): Promise<void> {
		const ids = (await metaGet<UUID[]>(LEDGERS_KEY)) ?? [];
		await metaSet(
			LEDGERS_KEY,
			ids.filter((x) => x !== id)
		);
	}

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
			if (p.claimedByDeviceId === this._deviceId) return p.id;
		}
		return undefined;
	}

	dispatch<K extends EventKind>(ledgerId: UUID, kind: K, payload: EventPayloads[K]): void {
		const author = this.claimedParticipantId(ledgerId) ?? 'p-unknown';
		const event = makeEvent(kind, payload, {
			id: crypto.randomUUID(),
			schemaVersion: 1,
			authorDeviceId: this._deviceId,
			authorParticipantId: author,
			entryAt: new Date().toISOString()
		});
		// Optimistic in-memory update (replace array so $state notices)…
		this.logs[ledgerId] = [...(this.logs[ledgerId] ?? []), event];
		// …then persist asynchronously, serialised per ledger.
		this.persist(ledgerId, event);
	}

	/** Local-only forget: drops the in-memory log and the IDB segments.
	 *  No remote deletion. */
	removeLedger(ledgerId: UUID): void {
		const next: Record<UUID, LedgerEvent[]> = {};
		for (const [id, events] of Object.entries(this.logs)) {
			if (id !== ledgerId) next[id] = events;
		}
		this.logs = next;
		this.writeChain[ledgerId] = (this.writeChain[ledgerId] ?? Promise.resolve())
			.then(() => deleteLedgerSegments(ledgerId))
			.then(() => this.unregisterLedger(ledgerId))
			.catch((err) => console.error('[app] removeLedger failed', err));
	}

	createLedger(name: string, yourName: string): UUID {
		const id = `led-${crypto.randomUUID().slice(0, 8)}`;
		const participantId = `p-${crypto.randomUUID().slice(0, 8)}`;
		this.logs[id] = [];
		void this.registerLedger(id);
		this.dispatch(id, 'LedgerRenamed', { name });
		this.dispatch(id, 'ParticipantAdded', { participantId, name: yourName });
		this.dispatch(id, 'ParticipantClaimed', { participantId, deviceId: this._deviceId });
		return id;
	}
}

export const app = new AppStore();
