<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';

	let { children } = $props();

	const ledgerId = $derived(page.params.ledgerId!);
	const exists = $derived(app.hasLedger(ledgerId));
	const ledger = $derived(exists ? app.derived(ledgerId) : undefined);
	const path = $derived(page.url.pathname);

	const base = $derived(`/ledger/${ledgerId}`);
	function tabCurrent(seg: string): 'page' | undefined {
		if (seg === '') {
			return path === base || path.startsWith(`${base}/expense`) ? 'page' : undefined;
		}
		return path.startsWith(`${base}/${seg}`) ? 'page' : undefined;
	}
</script>

{#if !exists}
	<div class="topbar"><a href="/">‹ Home</a><span class="title">Ledger not found</span></div>
	<div class="screen empty">
		<p>This ledger isn’t on this device.</p>
		<a class="btn" href="/">Back to ledgers</a>
	</div>
{:else}
	<div class="topbar">
		<a href="/" aria-label="Back to ledgers">‹</a>
		<span class="title">{ledger?.ledgerName}</span>
		<a href="{base}/settings" title="Sync: in sync">☁</a>
		<a href="{base}/settings" aria-label="Settings">⋮</a>
	</div>

	{@render children()}

	<nav class="tabbar">
		<a href={base} aria-current={tabCurrent('')}>Expenses</a>
		<a href="{base}/balances" aria-current={tabCurrent('balances')}>Balances</a>
		<a href="{base}/labels" aria-current={tabCurrent('labels')}>Labels</a>
		<a href="{base}/export" aria-current={tabCurrent('export')}>Export</a>
	</nav>
{/if}
