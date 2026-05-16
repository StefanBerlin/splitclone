<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { app } from '$lib/ui/stores/app.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if app.ready}
	{@render children()}
{:else}
	<div class="screen empty">
		<p>Loading…</p>
	</div>
{/if}
