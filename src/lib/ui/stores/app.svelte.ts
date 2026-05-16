/**
 * Application store façade. The UI reads a synchronous in-memory cache (the
 * `$state` logs) and writes through it; persistence to IndexedDB segments
 * happens asynchronously underneath, keeping the API the 12 screens use
 * unchanged from Phase 3.
 *
 * Phase 5: every ledger has a 256-bit AES-GCM data key. Segments are sealed
 * before they touch IndexedDB (SC-ARC-ENC-2); the key is a non-extractable
 * CryptoKey persisted per ledger (SC-ARC-ENC-5). The recovery/join-code
 * surface (SC-ARC-ENC-4, -6) is exposed here for the create/join screens.
 * Phase 6 adds the OneDrive provider behind the same façade.
 */
import { fold, makeEvent } from '$lib/domain';
import type { DerivedState, EventKind, EventPayloads, LedgerEvent, UUID } from '$lib/domain';
import { getDeviceId } from '$lib/platform/device-id';
import { keyGet, keyPut, metaGet, metaSet } from '$lib/storage/indexed-db';
import { dataKeyFingerprint, generateDataKey, importDataKey } from '$lib/storage/encryption';
import { decodeJoinCode, encodeJoinCode } from '$lib/storage/join-code';
import { appendEvent, deleteLedgerSegments, loadLedgerEvents } from '$lib/storage/segment-store';
import { isOneDriveConfigured } from '$lib/auth/config';
import { getAccessToken, isConnected, disconnect } from '$lib/auth/token-store';
import { OneDriveGraphProvider, type RootRef } from '$lib/storage/providers/onedrive-graph';
import { listSharedFolders } from '$lib/storage/providers/shared';
import { checkRemoteLedger, syncLedger } from '$lib/sync/engine';
import { DEMO_LEDGER_ID, seedEvents } from './seed';

export type SyncState = 'idle' | 'syncing' | 'error';

export interface LedgerSummary {
	id: UUID;
	name: string;
	participantCount: number;
	lastActivity?: string;
}

export interface JoinCodePreview {
	ok: boolean;
	fingerprint?: string;
	error?: string;
}

const LEDGERS_KEY = 'ledgers';
const RECOVERY_ACK_KEY = 'recoveryAck';

class AppStore {
	private logs = $state<Record<UUID, LedgerEvent[]>>({});
	private _ready = $state(false);
	private _deviceId = $state('');
	/** Non-extractable data key per ledger (in-memory mirror of the IDB store). */
	private keys: Record<UUID, CryptoKey> = {};
	/** Recovery surface per ledger: re-displayable join code + fingerprint +
	 *  where its OneDrive folder lives (once known). */
	private keyMeta = $state<Record<UUID, { joinCode: string; fingerprint: string; root?: RootRef }>>(
		{}
	);
	private recoveryAck = $state<UUID[]>([]);
	/** Per-ledger serialised write chain: segment append is read-modify-write,
	 *  so concurrent dispatches must not overlap. */
	private writeChain: Record<UUID, Promise<void>> = {};
	/** OneDrive connection + sync status (SC-FR-SYN-3). */
	private _connected = $state(false);
	private _syncState = $state<SyncState>('idle');
	private _syncError = $state('');

	constructor() {
		void this.init();
	}

	get ready(): boolean {
		return this._ready;
	}
	get deviceId(): string {
		return this._deviceId;
	}
	/** True when a OneDrive client id is configured (else the app is purely
	 *  local and "Connect OneDrive" is hidden). */
	get oneDriveConfigured(): boolean {
		return isOneDriveConfigured();
	}
	get connected(): boolean {
		return this._connected;
	}
	get syncState(): SyncState {
		return this._syncState;
	}
	get syncError(): string {
		return this._syncError;
	}

	private async init(): Promise<void> {
		try {
			this._deviceId = await getDeviceId();
			this.recoveryAck = (await metaGet<UUID[]>(RECOVERY_ACK_KEY)) ?? [];
			let ids = (await metaGet<UUID[]>(LEDGERS_KEY)) ?? [];

			if (ids.length === 0) {
				// First run on this device: mint a key for the demo ledger and
				// persist its sealed seed so it survives a reload.
				const key = await this.mintLedgerKey(DEMO_LEDGER_ID);
				const seeded = this.normaliseSeed(seedEvents(), this._deviceId);
				for (const ev of seeded) {
					await appendEvent(DEMO_LEDGER_ID, this._deviceId, key, ev);
				}
				ids = [DEMO_LEDGER_ID];
				await metaSet(LEDGERS_KEY, ids);
			}

			const loaded: Record<UUID, LedgerEvent[]> = {};
			await Promise.all(
				ids.map(async (id) => {
					const rec = await keyGet(id);
					if (!rec) {
						console.error(`[app] no data key for ledger ${id}; skipping`);
						loaded[id] = [];
						return;
					}
					this.keys[id] = rec.key;
					this.keyMeta[id] = {
						joinCode: rec.joinCode,
						fingerprint: rec.fingerprint,
						root: rec.root
					};
					loaded[id] = await loadLedgerEvents(id, rec.key);
				})
			);
			this.logs = loaded;
			if (this.oneDriveConfigured) this._connected = await isConnected();
		} catch (err) {
			console.error('[app] init failed; running with empty in-memory state', err);
		} finally {
			this._ready = true;
		}
	}

	/** Generate + persist a fresh data key for a ledger, returning the
	 *  non-extractable handle. Raw bytes exist only across these few lines
	 *  (architecture §10). */
	private async mintLedgerKey(ledgerId: UUID): Promise<CryptoKey> {
		const { key, raw } = await generateDataKey();
		const fingerprint = await dataKeyFingerprint(raw);
		const joinCode = await encodeJoinCode(raw);
		raw.fill(0);
		// Created here ⇒ this account owns the OneDrive folder for it.
		const root: RootRef = { kind: 'own', ledgerId };
		await keyPut({ ledgerId, key, fingerprint, joinCode, root });
		this.keys[ledgerId] = key;
		this.keyMeta[ledgerId] = { joinCode, fingerprint, root };
		return key;
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
		const key = this.keys[ledgerId];
		if (!key) {
			console.error(`[app] cannot persist: no data key for ledger ${ledgerId}`);
			return;
		}
		this.writeChain[ledgerId] = (this.writeChain[ledgerId] ?? Promise.resolve())
			.then(() => appendEvent(ledgerId, this._deviceId, key, event))
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

	async createLedger(name: string, yourName: string): Promise<UUID> {
		const id = `led-${crypto.randomUUID().slice(0, 8)}`;
		const participantId = `p-${crypto.randomUUID().slice(0, 8)}`;
		await this.mintLedgerKey(id);
		this.logs[id] = [];
		await this.registerLedger(id);
		this.dispatch(id, 'LedgerRenamed', { name });
		this.dispatch(id, 'ParticipantAdded', { participantId, name: yourName });
		this.dispatch(id, 'ParticipantClaimed', { participantId, deviceId: this._deviceId });
		return id;
	}

	// ---- Recovery / join-code surface (SC-ARC-ENC-4, -6) -------------------

	/** The re-displayable recovery/join code for a ledger this device holds. */
	joinCodeFor(ledgerId: UUID): string | undefined {
		return this.keyMeta[ledgerId]?.joinCode;
	}

	keyFingerprintFor(ledgerId: UUID): string | undefined {
		return this.keyMeta[ledgerId]?.fingerprint;
	}

	recoveryAcknowledged(ledgerId: UUID): boolean {
		return this.recoveryAck.includes(ledgerId);
	}

	acknowledgeRecovery(ledgerId: UUID): void {
		if (this.recoveryAck.includes(ledgerId)) return;
		this.recoveryAck = [...this.recoveryAck, ledgerId];
		void metaSet(RECOVERY_ACK_KEY, this.recoveryAck);
	}

	/** Client-side validation of a pasted join code (SC-ARC-ENC-4). The actual
	 *  remote fetch + fingerprint-vs-metadata check (SC-ARC-ENC-3) needs the
	 *  OneDrive provider and lands in Phase 6, so this only proves the code is
	 *  well-formed and shows the key fingerprint it would unlock. */
	async previewJoinCode(code: string): Promise<JoinCodePreview> {
		const decoded = await decodeJoinCode(code);
		if (!decoded.ok || !decoded.raw) {
			return { ok: false, error: decoded.error ?? 'Invalid join code.' };
		}
		// Round-trip through importKey so a structurally-valid-but-unusable key
		// (e.g. wrong length slipping past) is still caught here.
		await importDataKey(decoded.raw);
		const fingerprint = await dataKeyFingerprint(decoded.raw);
		decoded.raw.fill(0);
		return { ok: true, fingerprint };
	}

	// ---- OneDrive connection + sync (Phase 6) -----------------------------

	/** Called by /auth/callback once tokens have been adopted. */
	async refreshConnection(): Promise<void> {
		this._connected = await isConnected();
	}

	async signOut(): Promise<void> {
		await disconnect();
		this._connected = false;
	}

	private providerFor(ledgerId: UUID): OneDriveGraphProvider {
		const root: RootRef = this.keyMeta[ledgerId]?.root ?? { kind: 'own', ledgerId };
		return new OneDriveGraphProvider(getAccessToken, root);
	}

	private async reloadLedger(id: UUID): Promise<void> {
		const key = this.keys[id];
		if (!key) return;
		this.logs[id] = await loadLedgerEvents(id, key);
	}

	/** Manual sync (SC-FR-SYN-2): pull others' segments, push ours, re-fold. */
	async syncNow(ledgerId: UUID): Promise<void> {
		if (!this._connected) {
			this._syncError = 'Not connected to OneDrive.';
			this._syncState = 'error';
			return;
		}
		const fp = this.keyMeta[ledgerId]?.fingerprint;
		if (!fp) return;
		this._syncState = 'syncing';
		this._syncError = '';
		try {
			// Make sure our optimistic in-memory writes are flushed to IDB
			// segments before we upload them.
			await (this.writeChain[ledgerId] ?? Promise.resolve());
			await syncLedger(this.providerFor(ledgerId), ledgerId, this._deviceId, fp);
			await this.reloadLedger(ledgerId);
			this._syncState = 'idle';
		} catch (err) {
			this._syncState = 'error';
			this._syncError = err instanceof Error ? err.message : String(err);
			console.error('[app] sync failed', err);
		}
	}

	/**
	 * Join a ledger shared from another person's OneDrive (SC-ARC-ENC-3,
	 * SC-ARC-PRV-3): decode the code, scan folders shared with this account,
	 * and adopt the one whose plaintext metadata fingerprint matches.
	 */
	async joinViaOneDrive(code: string): Promise<{ ok: boolean; ledgerId?: UUID; error?: string }> {
		if (!this._connected) return { ok: false, error: 'Connect OneDrive first.' };
		const decoded = await decodeJoinCode(code);
		if (!decoded.ok || !decoded.raw) {
			return { ok: false, error: decoded.error ?? 'Invalid join code.' };
		}
		const raw = decoded.raw;
		try {
			const shared = await listSharedFolders(getAccessToken);
			for (const folder of shared) {
				const provider = new OneDriveGraphProvider(getAccessToken, folder.root);
				try {
					const meta = await checkRemoteLedger(provider, raw);
					// Match → adopt this ledger.
					const id = meta.ledgerId;
					const key = await importDataKey(raw);
					const fingerprint = await dataKeyFingerprint(raw);
					const joinCode = await encodeJoinCode(raw);
					raw.fill(0);
					await keyPut({ ledgerId: id, key, fingerprint, joinCode, root: folder.root });
					this.keys[id] = key;
					this.keyMeta[id] = { joinCode, fingerprint, root: folder.root };
					this.logs[id] = [];
					await this.registerLedger(id);
					await this.syncNow(id);
					return { ok: true, ledgerId: id };
				} catch {
					continue; // not this folder (mismatch / not a SplitClone folder)
				}
			}
			return {
				ok: false,
				error: 'No shared ledger matches this code. Ask the owner to share the folder with you.'
			};
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
}

export const app = new AppStore();
