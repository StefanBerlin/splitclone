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
import { deviceClaim, fold, makeEvent, unclaimedParticipants } from '$lib/domain';
import type {
	DerivedState,
	EventKind,
	EventPayloads,
	LedgerEvent,
	Participant,
	UUID
} from '$lib/domain';
import { getDeviceId } from '$lib/platform/device-id';
import { keyGet, keyPut, metaGet, metaSet, segmentsDeleteForeign } from '$lib/storage/indexed-db';
import { dataKeyFingerprint, generateDataKey, importDataKey } from '$lib/storage/encryption';
import { decodeJoinCode, encodeJoinCode } from '$lib/storage/join-code';
import { appendEvent, deleteLedgerSegments, loadLedgerEvents } from '$lib/storage/segment-store';
import { isOneDriveConfigured } from '$lib/auth/config';
import { getAccessToken, isConnected, disconnect } from '$lib/auth/token-store';
import { OneDriveGraphProvider, type RootRef } from '$lib/storage/providers/onedrive-graph';
import {
	listOwnLedgerFolders,
	listSharedChildFolders,
	listSharedFolders
} from '$lib/storage/providers/shared';
import { checkRemoteLedger, syncLedger } from '$lib/sync/engine';
import { DEMO_LEDGER_ID, seedEvents } from './seed';

/** SC-FR-SYN-3: idle = in sync, plus syncing / offline / error. */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

/** SC-FR-SYN-1: a commit must reach the shared folder within 10 s. We coalesce
 *  a burst of commits behind one timer well inside that budget. */
const AUTO_SYNC_DEBOUNCE_MS = 3000;

/** Turn an opaque thrown value into something a user can act on. Bare
 *  DOMExceptions (notably WebCrypto's `OperationError`, whose message is the
 *  unhelpful "The operation failed for an operation-specific reason") are the
 *  reason this exists. */
function describeError(err: unknown): string {
	if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
		if (err.name === 'OperationError') {
			return 'Could not decrypt synced data (key mismatch or corrupted segment).';
		}
		return `${err.name}: ${err.message || 'no detail'}`;
	}
	if (err instanceof Error) return err.message || err.name;
	return String(err);
}

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

/** Execution-date range + label-id filter (SC-FR-HIS-4/5). */
export interface LedgerFilter {
	from: string;
	to: string;
	labels: UUID[];
}

const EMPTY_FILTER: Readonly<LedgerFilter> = Object.freeze({ from: '', to: '', labels: [] });

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
	/** Auto-sync scheduling (SC-FR-SYN-1). One coalescing timer per ledger; a
	 *  per-ledger in-flight guard so a debounced run and a focus/manual run
	 *  never overlap on the same folder. */
	private autoTimers: Record<UUID, ReturnType<typeof setTimeout>> = {};
	private syncing = new Set<UUID>();
	private listenersInstalled = false;
	/** Per-ledger history filter (SC-FR-HIS-4/5), shared so the export route
	 *  can honour the filter active in the list at export time (SC-FR-EXR-5).
	 *  Replaced immutably (never mutated in place) like `logs`. */
	private _filters = $state<Record<UUID, LedgerFilter>>({});

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
					try {
						if (id === DEMO_LEDGER_ID) {
							// The demo ledger is local-only with a per-device key. A
							// prior bug auto-synced it under a shared constant path;
							// purge any other device's (un-decryptable) segments that
							// leaked in, and only ever fold this device's own.
							const purged = await segmentsDeleteForeign(id, this._deviceId);
							if (purged > 0) {
								console.warn(`[app] removed ${purged} foreign segment(s) from the demo ledger`);
							}
							loaded[id] = await loadLedgerEvents(id, rec.key, this._deviceId);
						} else {
							loaded[id] = await loadLedgerEvents(id, rec.key);
						}
					} catch (e) {
						// Isolate: one unreadable ledger must not blank the others.
						console.error(`[app] failed to load ledger ${id}`, e);
						loaded[id] = [];
					}
				})
			);
			this.logs = loaded;
			if (this.oneDriveConfigured) {
				this._connected = await isConnected();
				this.installSyncListeners();
				// SC-FR-SYN-1: pull on open.
				if (this._connected) void this.syncAllConnected();
			}
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

	// ---- History filter, shared list↔export (SC-FR-HIS-4/5, SC-FR-EXR-5) ---

	/** Pure read: the active filter for a ledger (default = no filter). */
	filter(ledgerId: UUID): Readonly<LedgerFilter> {
		return this._filters[ledgerId] ?? EMPTY_FILTER;
	}

	filterActive(ledgerId: UUID): boolean {
		const f = this.filter(ledgerId);
		return f.from !== '' || f.to !== '' || f.labels.length > 0;
	}

	setFilter(ledgerId: UUID, patch: Partial<LedgerFilter>): void {
		const cur = this.filter(ledgerId);
		this._filters = { ...this._filters, [ledgerId]: { ...cur, ...patch } };
	}

	toggleFilterLabel(ledgerId: UUID, labelId: UUID): void {
		const cur = this.filter(ledgerId);
		this.setFilter(ledgerId, {
			labels: cur.labels.includes(labelId)
				? cur.labels.filter((x) => x !== labelId)
				: [...cur.labels, labelId]
		});
	}

	clearFilter(ledgerId: UUID): void {
		this._filters = { ...this._filters, [ledgerId]: { from: '', to: '', labels: [] } };
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
		return deviceClaim(this.derived(ledgerId), this._deviceId)?.id;
	}

	// ---- Multi-device participant claim (SC-FR-PRT-2) ---------------------

	/** A ledger this device holds but has not yet bound a participant to.
	 *  True for a freshly-joined ledger (the owner's participants exist but
	 *  none is ours); false for empty/just-created ledgers, which auto-claim. */
	needsClaim(ledgerId: UUID): boolean {
		if (!this.hasLedger(ledgerId)) return false;
		const s = this.derived(ledgerId);
		if (s.participants.size === 0) return false;
		return !deviceClaim(s, this._deviceId);
	}

	/** Existing participants no device owns — claim candidates (SC-FR-PRT-2a,
	 *  includes deviceless placeholders per SC-FR-PRT-4). */
	unclaimedParticipantList(ledgerId: UUID): Participant[] {
		return unclaimedParticipants(this.derived(ledgerId));
	}

	/** SC-FR-PRT-2a: bind this device to an existing participant entry. */
	claimParticipant(ledgerId: UUID, participantId: UUID): void {
		if (this.claimedParticipantId(ledgerId)) return;
		this.dispatch(ledgerId, 'ParticipantClaimed', {
			participantId,
			deviceId: this._deviceId
		});
	}

	/** SC-FR-PRT-2b: create a new participant and claim it in one step. */
	addAndClaimParticipant(ledgerId: UUID, name: string): void {
		if (this.claimedParticipantId(ledgerId)) return;
		const participantId = `p-${crypto.randomUUID().slice(0, 8)}`;
		this.dispatch(ledgerId, 'ParticipantAdded', { participantId, name });
		this.dispatch(ledgerId, 'ParticipantClaimed', {
			participantId,
			deviceId: this._deviceId
		});
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
		// …then persist asynchronously, serialised per ledger…
		this.persist(ledgerId, event);
		// …and schedule a push to OneDrive within the SC-FR-SYN-1 budget.
		this.scheduleAutoSync(ledgerId);
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
		if (this._connected) {
			this.installSyncListeners();
			void this.syncAllConnected();
		}
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

	/** The seed/demo ledger is local-only: a constant id but a per-device key,
	 *  so it must never round-trip through the shared OneDrive path. */
	private isSyncable(ledgerId: UUID): boolean {
		return ledgerId !== DEMO_LEDGER_ID;
	}

	/** Manual sync (SC-FR-SYN-2): force an immediate pull+push for one ledger. */
	async syncNow(ledgerId: UUID): Promise<void> {
		if (!this.isSyncable(ledgerId)) return; // demo ledger: nothing to sync
		if (!this._connected) {
			this._syncError = 'Not connected to OneDrive.';
			this._syncState = 'error';
			return;
		}
		this.cancelAutoTimer(ledgerId);
		await this.runSync(ledgerId);
	}

	/** Shared pull→push→refold core. Serialised per ledger via `syncing` so a
	 *  debounced run, a focus run and a manual run can't collide on one folder.
	 *  `offline` is reported, not treated as a hard error (SC-FR-SYN-3). */
	private async runSync(ledgerId: UUID): Promise<void> {
		if (!this.isSyncable(ledgerId)) return;
		if (!this._connected || this.syncing.has(ledgerId)) return;
		const fp = this.keyMeta[ledgerId]?.fingerprint;
		if (!fp) return;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			this._syncState = 'offline';
			return; // a queued change stays pending; the 'online' listener retries
		}
		this.syncing.add(ledgerId);
		this._syncState = 'syncing';
		this._syncError = '';
		try {
			// Flush optimistic in-memory writes to sealed IDB segments first.
			await (this.writeChain[ledgerId] ?? Promise.resolve());
			await syncLedger(this.providerFor(ledgerId), ledgerId, this._deviceId, fp);
			await this.reloadLedger(ledgerId);
			this._syncState = 'idle';
		} catch (err) {
			this._syncState = 'error';
			this._syncError = describeError(err);
			console.error('[app] sync failed', err);
		} finally {
			this.syncing.delete(ledgerId);
		}
	}

	// ---- Background / automatic sync (SC-FR-SYN-1) ------------------------

	private cancelAutoTimer(ledgerId: UUID): void {
		const t = this.autoTimers[ledgerId];
		if (t !== undefined) {
			clearTimeout(t);
			delete this.autoTimers[ledgerId];
		}
	}

	/** Coalesce a burst of commits behind one timer (non-resetting, so it can't
	 *  be starved past the SC-FR-SYN-1 10 s budget) and then push. */
	private scheduleAutoSync(ledgerId: UUID): void {
		if (!this.isSyncable(ledgerId)) return;
		if (!this.oneDriveConfigured || !this._connected) return;
		if (!this.keyMeta[ledgerId]?.fingerprint) return;
		if (this.autoTimers[ledgerId] !== undefined) return; // already pending
		this.autoTimers[ledgerId] = setTimeout(() => {
			delete this.autoTimers[ledgerId];
			void this.runSync(ledgerId);
		}, AUTO_SYNC_DEBOUNCE_MS);
	}

	/** SC-FR-SYN-1: pull (+push) every connected ledger. Triggered on open and
	 *  whenever the app returns to the foreground / regains connectivity. */
	async syncAllConnected(): Promise<void> {
		if (!this._connected) return;
		for (const id of Object.keys(this.logs)) {
			if (this.keyMeta[id]?.fingerprint) await this.runSync(id);
		}
	}

	/** Window/visibility/connectivity wiring. Installed once, browser-only. */
	private installSyncListeners(): void {
		if (this.listenersInstalled || typeof window === 'undefined') return;
		this.listenersInstalled = true;
		const foreground = () => {
			if (document.visibilityState !== 'hidden') void this.syncAllConnected();
		};
		window.addEventListener('focus', foreground);
		document.addEventListener('visibilitychange', foreground);
		window.addEventListener('online', () => void this.syncAllConnected());
		window.addEventListener('offline', () => {
			if (this._syncState !== 'syncing') this._syncState = 'offline';
		});
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
			// Own folders first — same-account multi-device, or re-adopting
			// your own ledger after local data loss, needs no sharing. Then
			// folders other people shared with this account.
			const [own, shared] = await Promise.all([
				listOwnLedgerFolders(getAccessToken),
				listSharedFolders(getAccessToken)
			]);
			// A shared item may be the ledger folder itself, or the parent
			// SplitClone folder shared once for all ledgers — so also descend
			// one level into each shared folder.
			const sharedChildren = (
				await Promise.all(shared.map((f) => listSharedChildFolders(getAccessToken, f.root)))
			).flat();
			const roots: RootRef[] = [
				...own.map((f) => f.root),
				...shared.map((f) => f.root),
				...sharedChildren.map((f) => f.root)
			];
			for (const root of roots) {
				const provider = new OneDriveGraphProvider(getAccessToken, root);
				try {
					const meta = await checkRemoteLedger(provider, raw);
					// Match → adopt this ledger.
					const id = meta.ledgerId;
					const key = await importDataKey(raw);
					const fingerprint = await dataKeyFingerprint(raw);
					const joinCode = await encodeJoinCode(raw);
					raw.fill(0);
					await keyPut({ ledgerId: id, key, fingerprint, joinCode, root });
					this.keys[id] = key;
					this.keyMeta[id] = { joinCode, fingerprint, root };
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
				error:
					'No ledger matches this code. On a different account, ask the owner to share the ledger folder with you; on the same account, make sure the creating device has synced at least once.'
			};
		} catch (err) {
			return { ok: false, error: describeError(err) };
		}
	}
}

export const app = new AppStore();
