/**
 * Minimal hand-rolled IndexedDB wrapper (SC-ARC-CCH-1, SC-NFR-SEC-2). No
 * third-party IDB library (architecture anti-dependency). Browser-only;
 * the app runs with ssr=false so this never executes server-side.
 *
 * Stores:
 *  - meta:     key/value for app-level data (deviceId, registered ledgers)
 *  - segments: per-device append-only log segments. Phase 4 stores plaintext
 *              JSONL text; Phase 5 wraps the text through the AES-GCM codec
 *              before it is written here / uploaded.
 */
const DB_NAME = 'splitclone';
const DB_VERSION = 1;

export interface SegmentRecord {
	/** `${ledgerId}::${deviceId}::${name}` */
	id: string;
	ledgerId: string;
	deviceId: string;
	/** Open-instant filename, lexicographically chronological (SC-ARC-LOG-4). */
	name: string;
	status: 'open' | 'closed';
	/** Plaintext JSONL (Phase 4). */
	text: string;
	byteLength: number;
	updatedAt: string;
}

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
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
	});
	return dbPromise;
}

function tx<T>(
	store: 'meta' | 'segments',
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

/** Test/maintenance helper: wipe everything. */
export async function wipeAll(): Promise<void> {
	await tx('meta', 'readwrite', (s) => s.clear());
	await tx('segments', 'readwrite', (s) => s.clear());
}
