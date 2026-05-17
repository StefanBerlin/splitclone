/**
 * Minimal hand-rolled IndexedDB wrapper (SC-ARC-CCH-1, SC-NFR-SEC-2). No
 * third-party IDB library (architecture anti-dependency). Browser-only;
 * the app runs with ssr=false so this never executes server-side.
 *
 * Stores:
 *  - meta:     key/value for app-level data (deviceId, registered ledgers)
 *  - segments: per-device append-only log segments. Phase 5: the segment
 *              body is the AES-GCM-sealed envelope (IV‖ciphertext‖tag), never
 *              plaintext (SC-ARC-ENC-2). Nothing readable at rest.
 *  - keys:     per-ledger data key as a NON-extractable CryptoKey handle plus
 *              its fingerprint (SC-ARC-ENC-3, SC-ARC-ENC-5).
 *
 * The IndexedDB layout is private to a device and explicitly NOT part of the
 * shared file format (SC-ARC-FMT-1), so it may evolve freely. The v1→v2
 * upgrade therefore just drops local caches; first run re-seeds.
 */
import type { RootRef } from './providers/onedrive-graph';

const DB_NAME = 'splitclone';
const DB_VERSION = 2;

export interface SegmentRecord {
	/** `${ledgerId}::${deviceId}::${name}` */
	id: string;
	ledgerId: string;
	deviceId: string;
	/** Open-instant filename, lexicographically chronological (SC-ARC-LOG-4). */
	name: string;
	status: 'open' | 'closed';
	/** Sealed envelope: 12-byte IV ‖ ciphertext ‖ 16-byte GCM tag. */
	sealed: Uint8Array;
	/** Plaintext JSONL length, drives rotation policy (SC-ARC-LOG-5). */
	byteLength: number;
	updatedAt: string;
	/** OneDrive ETag last seen for this segment (Phase 6 sync bookkeeping).
	 *  Private cache field, not part of the file format (SC-ARC-FMT-1). */
	remoteEtag?: string;
}

export interface KeyRecord {
	ledgerId: string;
	/** Non-extractable AES-GCM CryptoKey (structured-clone-persisted). Used for
	 *  all encrypt/decrypt; raw bytes are not recoverable from it. */
	key: CryptoKey;
	/** SC-ARC-ENC-3 fingerprint (32 hex chars). */
	fingerprint: string;
	/** The join code string. Persisted because SC-ARC-ENC-6 requires the
	 *  recovery code be re-displayable on demand, and the non-extractable
	 *  `key` cannot regenerate it. This is the only surviving externalised
	 *  form of the key material (architecture §10). */
	joinCode: string;
	/** Where this ledger's OneDrive folder lives, once connected: `own`
	 *  (this account created it) or `shared` (joined from someone else's
	 *  drive). Absent until first sync/join. Private cache, not file format. */
	root?: RootRef;
}

type StoreName = 'meta' | 'segments' | 'keys';

export function segmentId(ledgerId: string, deviceId: string, name: string): string {
	return `${ledgerId}::${deviceId}::${name}`;
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB unavailable (must run in a browser)'));
			return;
		}
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains('meta')) {
				db.createObjectStore('meta', { keyPath: 'key' });
			}
			if (!db.objectStoreNames.contains('segments')) {
				const s = db.createObjectStore('segments', { keyPath: 'id' });
				s.createIndex('byLedger', 'ledgerId', { unique: false });
			}
			if (!db.objectStoreNames.contains('keys')) {
				db.createObjectStore('keys', { keyPath: 'ledgerId' });
			}
			// v1 stored plaintext segments with no keys; those bytes cannot be
			// re-sealed, so drop local caches and let first run re-seed.
			const upgradeTx = req.transaction;
			if (upgradeTx && req.result.objectStoreNames.contains('segments')) {
				upgradeTx.objectStore('meta').clear();
				upgradeTx.objectStore('segments').clear();
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
	});
	return dbPromise;
}

function tx<T>(
	store: StoreName,
	mode: IDBTransactionMode,
	run: (s: IDBObjectStore) => IDBRequest<T> | { result: T }
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const t = db.transaction(store, mode);
				const result = run(t.objectStore(store));
				t.oncomplete = () =>
					resolve(
						'result' in result ? (result as { result: T }).result : (result as IDBRequest<T>).result
					);
				t.onerror = () => reject(t.error ?? new Error(`IndexedDB ${store} tx failed`));
				t.onabort = () => reject(t.error ?? new Error(`IndexedDB ${store} tx aborted`));
			})
	);
}

interface MetaRow<T> {
	key: string;
	value: T;
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
	const row = await tx<MetaRow<T> | undefined>('meta', 'readonly', (s) => s.get(key));
	return row?.value;
}

export async function metaSet<T>(key: string, value: T): Promise<void> {
	await tx('meta', 'readwrite', (s) => s.put({ key, value } satisfies MetaRow<T>));
}

export async function segmentsByLedger(ledgerId: string): Promise<SegmentRecord[]> {
	return tx<SegmentRecord[]>('segments', 'readonly', (s) =>
		s.index('byLedger').getAll(IDBKeyRange.only(ledgerId))
	);
}

export async function segmentPut(rec: SegmentRecord): Promise<void> {
	await tx('segments', 'readwrite', (s) => s.put(rec));
}

export async function segmentsDeleteByLedger(ledgerId: string): Promise<void> {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const t = db.transaction('segments', 'readwrite');
		const store = t.objectStore('segments');
		const cur = store.index('byLedger').openKeyCursor(IDBKeyRange.only(ledgerId));
		cur.onsuccess = () => {
			const c = cur.result;
			if (c) {
				store.delete(c.primaryKey);
				c.continue();
			}
		};
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error ?? new Error('segment delete failed'));
	});
}

export async function keyGet(ledgerId: string): Promise<KeyRecord | undefined> {
	return tx<KeyRecord | undefined>('keys', 'readonly', (s) => s.get(ledgerId));
}

export async function keyPut(rec: KeyRecord): Promise<void> {
	await tx('keys', 'readwrite', (s) => s.put(rec));
}

export async function keyDelete(ledgerId: string): Promise<void> {
	await tx('keys', 'readwrite', (s) => s.delete(ledgerId));
}

/** Test/maintenance helper: wipe everything. */
export async function wipeAll(): Promise<void> {
	await tx('meta', 'readwrite', (s) => s.clear());
	await tx('segments', 'readwrite', (s) => s.clear());
	await tx('keys', 'readwrite', (s) => s.clear());
}
