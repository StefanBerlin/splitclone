<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { version } from '$app/environment';
	import { app } from '$lib/ui/stores/app.svelte';
	import { initTheme } from '$lib/ui/theme';

	let { children } = $props();

	// Apply the stored theme before the first screen renders (client-only SPA).
	initTheme();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- SC-ARC-HST-2: identifies the exact deployed commit (= SW cache key). -->
	<meta name="splitclone-build" content={version} />
</svelte:head>

{#if app.ready}
	{@render children()}
{:else}
	<div class="screen empty">
		<p>Loading…</p>
	</div>
{/if}
