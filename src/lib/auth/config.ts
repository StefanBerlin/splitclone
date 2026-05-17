/**
 * OAuth / Microsoft Graph configuration (SC-ARC-PRV-3, SC-NFR-SEC-2).
 *
 * Personal Microsoft accounts only (OneDrive personal / family) → the
 * `consumers` authority. Public PKCE client, no secret. Scope is
 * `Files.ReadWrite` (architecture §7): needed so a ledger folder one person
 * owns and shares can be opened by other people from their own accounts via
 * "shared with me" — true multi-user sharing, the core use case. No
 * mail/calendar/contacts scopes are ever requested.
 *
 * Optional public env, read via `$env/dynamic/public` so a missing client
 * id is not a build error — the app then runs fully local-only and the
 * "Connect OneDrive" affordance is disabled.
 */
import { env } from '$env/dynamic/public';
import { base } from '$app/paths';

export const OAUTH_AUTHORITY = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
/** offline_access → refresh token; the rest is the minimal Graph surface. */
export const OAUTH_SCOPES = ['Files.ReadWrite', 'offline_access', 'openid'];

export interface OAuthConfig {
	clientId: string;
	redirectUri: string;
	authorizeEndpoint: string;
	tokenEndpoint: string;
	scopes: string[];
}

/** Resolved config, or `null` when no client id is configured. */
export function oauthConfig(): OAuthConfig | null {
	const clientId = env.PUBLIC_MS_CLIENT_ID?.trim();
	if (!clientId) return null;
	if (typeof window === 'undefined') return null; // redirect URI needs an origin
	const path = env.PUBLIC_MS_REDIRECT_PATH?.trim() || '/auth/callback';
	// `base` ('/splitclone' on the GitHub Pages project site, '' at the
	// domain root) must be part of the registered Entra redirect URI.
	return {
		clientId,
		redirectUri: new URL(`${base}${path}`, window.location.origin).toString(),
		authorizeEndpoint: `${OAUTH_AUTHORITY}/authorize`,
		tokenEndpoint: `${OAUTH_AUTHORITY}/token`,
		scopes: OAUTH_SCOPES
	};
}

export function isOneDriveConfigured(): boolean {
	return !!env.PUBLIC_MS_CLIENT_ID?.trim();
}
