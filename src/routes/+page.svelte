<script lang="ts">
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import { relativeTime } from '$lib/ui/format/format';

	const ledgers = $derived(app.list());
</script>

<svelte:head><title>SplitClone</title></svelte:head>

<div class="topbar">
	<span></span>
	<span class="title">SplitClone</span>
	<a href={resolve('/settings')} aria-label="Settings">⚙</a>
</div>

<div class="screen">
	{#if ledgers.length === 0}
		<div class="empty">
			<p>No ledgers on this device.</p>
			<p>
				A ledger keeps shared expenses for one group of people. Create a new one or join one a
				friend shared with you.
			</p>
		</div>
	{:else}
		<p class="section-head">Your ledgers</p>
		{#each ledgers as l (l.id)}
			<a
				class="row card"
				href={resolve('/ledger/[ledgerId]', { ledgerId: l.id })}
				style="margin-bottom: var(--space-3)"
			>
				<span class="glyph">{(l.name.trim()[0] ?? '?').toUpperCase()}</span>
				<span class="grow">
					<strong>{l.name}</strong><br />
					<span class="muted"
						>{l.participantCount} participants · {relativeTime(l.lastActivity)}</span
					>
				</span>
				<span class="muted">›</span>
			</a>
		{/each}
	{/if}

	<a class="btn btn-primary btn-block" href={resolve('/ledger/new')}>+ Create a new ledger</a>
	<a class="btn btn-block" href={resolve('/ledger/join')}>Join with a code</a>
	<a class="btn btn-block" href={resolve('/settings')}>Settings</a>
</div>
