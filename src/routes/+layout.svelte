<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { version } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import { initTheme } from '$lib/ui/theme';

	let { children } = $props();

	// Apply the stored theme before the first screen renders (client-only SPA).
	initTheme();

	// Show the global "home" button everywhere except the home screen itself.
	const onHome = $derived(page.route.id === '/');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- SC-ARC-HST-2: identifies the exact deployed commit (= SW cache key). -->
	<meta name="splitclone-build" content={version} />
</svelte:head>

{#if app.ready}
	{@render children()}
	{#if !onHome}
		<a class="home-btn" href={resolve('/')} aria-label="Home" title="Home">⌂</a>
	{/if}
{:else}
	<div class="screen empty">
		<p>Loading…</p>
	</div>
{/if}
