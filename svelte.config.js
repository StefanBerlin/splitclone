import adapter from '@sveltejs/adapter-static';
import { execSync } from 'node:child_process';

// SC-ARC-HST-2 / architecture §11: pin the build to the exact commit so the
// Service Worker cache key (`splitclone-${version}`) and the in-page
// build meta tag both identify precisely which deployed bundle is running.
// Falls back to a timestamp outside a git checkout (e.g. a tarball build).
function buildVersion() {
	try {
		const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		return dirty ? `${sha}-dirty` : sha;
	} catch {
		return `t${Date.now()}`;
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	// SplitClone is a client-only SPA: no application server (SC-ARC-HST-1).
	// The static adapter emits a fallback shell; the SvelteKit router resolves
	// dynamic routes (e.g. /ledger/[ledgerId]) entirely in the browser.
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		// GitHub Pages project site (project-splitclone-deploy-target). Every
		// internal link/goto goes through resolve() so this subpath is safe.
		paths: { base: '/splitclone' },
		version: { name: buildVersion() },
		// SC-ARC-HST-2 defence-in-depth. True per-asset SRI on SvelteKit's
		// hashed ESM chunks is not expressible (no integrity attr on dynamic
		// import / modulepreload graphs) — RELEASE.md records that limitation
		// and its mitigation (reproducible build + commit pin). CSP is the
		// enforceable part: 'hash' mode lets SvelteKit hash its own inline
		// bootstrap so script-src can stay 'self' with no 'unsafe-inline'.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self', 'https://graph.microsoft.com', 'https://login.microsoftonline.com'],
				'base-uri': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'manifest-src': ['self']
			}
		}
	}
};

export default config;
