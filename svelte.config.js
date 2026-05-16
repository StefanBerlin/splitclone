import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	// SplitClone is a client-only SPA: no application server (SC-ARC-HST-1).
	// The static adapter emits a fallback shell; the SvelteKit router resolves
	// dynamic routes (e.g. /ledger/[ledgerId]) entirely in the browser.
	kit: { adapter: adapter({ fallback: 'index.html' }) }
};

export default config;
