/**
 * Join-code encoding (SC-ARC-ENC-4). A join code carries the raw 256-bit
 * ledger data key out-of-band between users (messaging app, in-person QR,
 * etc.). It is NEVER sent to any network endpoint by the app.
 *
 * Textual form:  `SC1.<base64url(raw 32 bytes)>.<4-hex checksum>`
 * The checksum is the first 4 hex chars of SHA-256(raw key); it catches
 * paste/transcription typos before the stronger fingerprint check
 * (SC-ARC-ENC-3) runs against the ledger metadata.
 *
 * The same string is what the QR form (SC-ARC-ENC-4a) encodes, so QR and
 * paste are interchangeable.
 */

const PREFIX = 'SC1';
const KEY_BYTES = 32;

export interface DecodedJoinCode {
	ok: boolean;
	/** Present only when ok. */
	raw?: Uint8Array;
	/** Human-readable reason when !ok. */
	error?: string;
}

export async function encodeJoinCode(raw: Uint8Array): Promise<string> {
	if (raw.length !== KEY_BYTES) throw new Error(`expected ${KEY_BYTES}-byte key`);
	return `${PREFIX}.${base64urlEncode(raw)}.${await checksum(raw)}`;
}

export async function decodeJoinCode(input: string): Promise<DecodedJoinCode> {
	const code = input.trim();
	const [prefix, body, sum] = code.split('.');
	if (prefix !== PREFIX || body === undefined || sum === undefined) {
		return { ok: false, error: 'Not a SplitClone join code.' };
	}
	let raw: Uint8Array;
	try {
		raw = base64urlDecode(body);
	} catch {
		return { ok: false, error: 'Join code is malformed.' };
	}
	if (raw.length !== KEY_BYTES) {
		return { ok: false, error: 'Join code is malformed.' };
	}
	if ((await checksum(raw)) !== sum.toLowerCase()) {
		return { ok: false, error: 'Checksum mismatch — the code was mistyped or truncated.' };
	}
	return { ok: true, raw };
}

async function checksum(raw: Uint8Array): Promise<string> {
	const digest = new Uint8Array(
		await crypto.subtle.digest(
			'SHA-256',
			raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
		)
	);
	return [...digest.subarray(0, 2)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64urlEncode(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
