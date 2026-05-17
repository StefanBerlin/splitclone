/**
 * At-rest encryption codec (SC-ARC-ENC-1, SC-ARC-ENC-2, SC-ARC-ENC-3,
 * SC-ARC-ENC-5). Browser-native WebCrypto only — no third-party crypto
 * library (architecture anti-dependency).
 *
 * A ledger has one 256-bit AES-GCM "data key". Every event-log segment is
 * sealed with it before it touches non-volatile storage; the key itself is
 * held as a NON-extractable `CryptoKey` so a casual IndexedDB exfiltration
 * yields an opaque handle, not the raw 32 bytes.
 *
 * Segment envelope (SC-ARC-ENC-2), as written to storage / uploaded:
 *   [ 12-byte random IV ][ ciphertext (= plaintext length) ][ 16-byte GCM tag ]
 * (`crypto.subtle` returns ciphertext||tag as one buffer, so the tag is not
 * sliced out explicitly here.)
 */

const ALGO = 'AES-GCM';
const KEY_BITS = 256;
const IV_BYTES = 12;

/**
 * Create a fresh ledger data key. Returns both the non-extractable handle to
 * keep and the raw bytes — the caller derives the join code + fingerprint
 * from `raw`, then MUST drop its reference to `raw` (it is the only moment
 * raw key material exists outside WebCrypto; see architecture §10).
 */
export async function generateDataKey(): Promise<{ key: CryptoKey; raw: Uint8Array }> {
	const extractable = await crypto.subtle.generateKey({ name: ALGO, length: KEY_BITS }, true, [
		'encrypt',
		'decrypt'
	]);
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', extractable));
	const key = await importDataKey(raw);
	return { key, raw };
}

/** Import raw key bytes as a non-extractable handle (SC-ARC-ENC-5). */
export async function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: ALGO }, false, [
		'encrypt',
		'decrypt'
	]);
}

/**
 * Key fingerprint (SC-ARC-ENC-3): lowercase hex of the first 16 bytes of
 * SHA-256(raw key). Reveals nothing about the key but lets a joining device
 * confirm it imported the right one.
 */
export async function dataKeyFingerprint(raw: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', toArrayBuffer(raw)));
	return [...digest.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Seal one segment's plaintext bytes. Fresh IV every call (SC-ARC-ENC-2). */
export async function sealSegment(plaintext: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt({ name: ALGO, iv }, key, toArrayBuffer(plaintext))
	);
	const out = new Uint8Array(IV_BYTES + ct.length);
	out.set(iv, 0);
	out.set(ct, IV_BYTES);
	return out;
}

/**
 * Open a sealed segment. Throws on auth-tag mismatch (wrong key, corruption,
 * or tampering) — callers must surface this loudly, never skip (SC-ARC-ENC-2).
 */
export async function openSegment(sealed: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
	const iv = toArrayBuffer(sealed.subarray(0, IV_BYTES));
	const ct = toArrayBuffer(sealed.subarray(IV_BYTES));
	return new Uint8Array(await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct));
}

/** WebCrypto wants an ArrayBuffer; hand it a tight copy of the view. */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
	return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}
