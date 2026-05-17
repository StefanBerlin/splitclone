/**
 * Hand-rolled OAuth 2.0 Authorization-Code-with-PKCE (SC-ARC-PRV-3,
 * SC-NFR-SEC-2). No MSAL.js — the flow we need is small and the dependency
 * is large and opinionated (architecture §2 tech-choice note).
 *
 * The verifier/challenge/base64url helpers are pure and unit-tested; the
 * two network calls (`exchangeCode`, `refresh`) are thin `fetch` wrappers.
 */
import type { OAuthConfig } from './config';

export interface TokenSet {
	accessToken: string;
	/** Absolute epoch-ms expiry, computed from `expires_in` with slack. */
	accessExpiresAt: number;
	refreshToken: string;
}

export interface PkcePair {
	verifier: string;
	challenge: string;
}

const VERIFIER_BYTES = 32; // 43-char base64url, within the RFC 7636 43–128 range

export function base64url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 S256: challenge = base64url(SHA-256(verifier)). */
export async function createPkcePair(): Promise<PkcePair> {
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
	const digest = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
	);
	return { verifier, challenge: base64url(digest) };
}

/** Opaque value tying the callback back to the request that started it. */
export function randomState(): string {
	return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

export function buildAuthorizeUrl(cfg: OAuthConfig, challenge: string, state: string): string {
	const q = new URLSearchParams({
		client_id: cfg.clientId,
		response_type: 'code',
		redirect_uri: cfg.redirectUri,
		response_mode: 'query',
		scope: cfg.scopes.join(' '),
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256'
	});
	return `${cfg.authorizeEndpoint}?${q.toString()}`;
}

function toTokenSet(json: {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
}): TokenSet {
	return {
		accessToken: json.access_token,
		// 60 s slack so we refresh before, not on, expiry.
		accessExpiresAt: Date.now() + (json.expires_in - 60) * 1000,
		refreshToken: json.refresh_token ?? ''
	};
}

async function postToken(cfg: OAuthConfig, body: URLSearchParams): Promise<TokenSet> {
	const res = await fetch(cfg.tokenEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`Token endpoint ${res.status}: ${detail.slice(0, 300)}`);
	}
	return toTokenSet(await res.json());
}

export function exchangeCode(cfg: OAuthConfig, code: string, verifier: string): Promise<TokenSet> {
	return postToken(
		cfg,
		new URLSearchParams({
			client_id: cfg.clientId,
			grant_type: 'authorization_code',
			code,
			redirect_uri: cfg.redirectUri,
			code_verifier: verifier
		})
	);
}

export async function refresh(cfg: OAuthConfig, refreshToken: string): Promise<TokenSet> {
	const set = await postToken(
		cfg,
		new URLSearchParams({
			client_id: cfg.clientId,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			scope: cfg.scopes.join(' ')
		})
	);
	// Azure may or may not roll the refresh token; keep the old one if absent.
	if (!set.refreshToken) set.refreshToken = refreshToken;
	return set;
}
