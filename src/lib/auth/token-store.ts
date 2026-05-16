/**
 * Token persistence (SC-NFR-SEC-2, architecture §7 + open question A1).
 *
 * - Access token: in volatile module memory only, never written to storage.
 * - Refresh token: sealed with a per-origin non-extractable AES key (itself
 *   a CryptoKey handle in IndexedDB) before being stored. This is
 *   defence-in-depth — the wrapping key necessarily also lives in browser
 *   storage — exactly the honest trade-off SC-NFR-SEC-2 documents.
 *
 * One Microsoft account per origin (MVP single-active-ledger world), so a
 * single refresh-token slot is enough.
 */
import { openSegment, sealSegment } from '$lib/storage/encryption';
import { metaGet, metaSet } from '$lib/storage/indexed-db';
import { oauthConfig } from './config';
import { refresh, type TokenSet } from './pkce';

const WRAP_KEY = 'originWrapKey';
const REFRESH_KEY = 'msRefreshTokenSealed';

let access: { token: string; expiresAt: number } | null = null;

async function wrappingKey(): Promise<CryptoKey> {
	const existing = await metaGet<CryptoKey>(WRAP_KEY);
	if (existing) return existing;
	const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
	await metaSet(WRAP_KEY, key);
	return key;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function storeRefresh(token: string): Promise<void> {
	const sealed = await sealSegment(enc.encode(token), await wrappingKey());
	await metaSet(REFRESH_KEY, sealed);
}

async function loadRefresh(): Promise<string | null> {
	const sealed = await metaGet<Uint8Array>(REFRESH_KEY);
	if (!sealed) return null;
	try {
		return dec.decode(await openSegment(sealed, await wrappingKey()));
	} catch {
		return null; // wrapping key lost / tampered → treat as disconnected
	}
}

/** Persist a freshly-obtained token set (after the PKCE code exchange). */
export async function adoptTokens(set: TokenSet): Promise<void> {
	access = { token: set.accessToken, expiresAt: set.accessExpiresAt };
	if (set.refreshToken) await storeRefresh(set.refreshToken);
}

export async function isConnected(): Promise<boolean> {
	return access !== null || (await loadRefresh()) !== null;
}

/**
 * A usable access token, refreshing via the stored refresh token when the
 * in-memory one is missing/expired. `null` means "not connected" — the
 * caller should route the user through `/auth/start`.
 */
export async function getAccessToken(): Promise<string | null> {
	if (access && Date.now() < access.expiresAt) return access.token;
	const cfg = oauthConfig();
	if (!cfg) return null;
	const rt = await loadRefresh();
	if (!rt) return null;
	const set = await refresh(cfg, rt);
	await adoptTokens(set);
	return set.accessToken;
}

export async function disconnect(): Promise<void> {
	access = null;
	await metaSet(REFRESH_KEY, undefined);
}
