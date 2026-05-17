/**
 * App-shell service worker (SC-NFR-OFF-1: the app must launch offline).
 *
 * SvelteKit auto-registers this file in the built app (never in `dev`). The
 * data layer is already offline-first (IndexedDB + queued sync), so the SW's
 * only job is to make the *code* available without the network:
 *
 *  - precache the hashed immutable build + static files, and the SPA shell;
 *  - serve build/static assets cache-first (they're content-hashed);
 *  - serve navigations network-first, falling back to the cached shell so a
 *    cold offline launch still boots (the client router then takes over).
 *
 * Paths come from `$service-worker` (`base`), so this stays correct when the
 * deploy base path is introduced in a later phase.
 */
/// <reference types="@sveltejs/kit" />
import { base, build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `splitclone-${version}`;
const SHELL = `${base}/`;
const PRECACHE = [...build, ...files, SHELL];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// Best-effort: a single unreachable asset must not fail the install.
			await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

const isAsset = (url: URL) => build.includes(url.pathname) || files.includes(url.pathname);

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== location.origin) return; // never touch Graph/OneDrive

	if (isAsset(url)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const hit = await cache.match(request);
				if (hit) return hit;
				const res = await fetch(request);
				cache.put(request, res.clone());
				return res;
			})
		);
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch {
					const cache = await caches.open(CACHE);
					return (
						(await cache.match(SHELL)) ??
						(await cache.match(`${base}/index.html`)) ??
						Response.error()
					);
				}
			})()
		);
	}
});
