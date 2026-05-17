import { describe, expect, it } from 'vitest';
import { base64url, buildAuthorizeUrl, createPkcePair, randomState } from './pkce';
import type { OAuthConfig } from './config';

const cfg: OAuthConfig = {
	clientId: 'cid-123',
	redirectUri: 'http://localhost:5173/auth/callback',
	authorizeEndpoint: 'https://login.example/authorize',
	tokenEndpoint: 'https://login.example/token',
	scopes: ['Files.ReadWrite', 'offline_access']
};

describe('PKCE (RFC 7636, SC-NFR-SEC-2)', () => {
	it('base64url has no +, /, or = padding', () => {
		const s = base64url(new Uint8Array([251, 255, 191, 0, 1, 2]));
		expect(s).not.toMatch(/[+/=]/);
	});

	it('S256 challenge = base64url(SHA-256(verifier))', async () => {
		const { verifier, challenge } = await createPkcePair();
		const digest = new Uint8Array(
			await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
		);
		expect(challenge).toBe(base64url(digest));
		// RFC 7636: 43–128 chars.
		expect(verifier.length).toBeGreaterThanOrEqual(43);
		expect(verifier.length).toBeLessThanOrEqual(128);
	});

	it('pairs and states are unique per call', async () => {
		const a = await createPkcePair();
		const b = await createPkcePair();
		expect(a.verifier).not.toBe(b.verifier);
		expect(randomState()).not.toBe(randomState());
	});

	it('authorize URL carries S256 + the exact redirect/scope/state', () => {
		const url = new URL(buildAuthorizeUrl(cfg, 'CHAL', 'STATE'));
		expect(url.origin + url.pathname).toBe(cfg.authorizeEndpoint);
		const q = url.searchParams;
		expect(q.get('client_id')).toBe('cid-123');
		expect(q.get('code_challenge_method')).toBe('S256');
		expect(q.get('code_challenge')).toBe('CHAL');
		expect(q.get('state')).toBe('STATE');
		expect(q.get('redirect_uri')).toBe(cfg.redirectUri);
		expect(q.get('scope')).toBe('Files.ReadWrite offline_access');
		expect(q.get('response_type')).toBe('code');
	});
});
