<script lang="ts">
	import { app } from '$lib/ui/stores/app.svelte';
	import { relativeTime } from '$lib/ui/format/format';

	const ledgers = $derived(app.list());
</script>

<svelte:head><title>SplitClone</title></svelte:head>

<div class="topbar"><span class="title">SplitClone</span></div>

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
			<a class="row card" href="/ledger/{l.id}" style="margin-bottom: var(--space-3)">
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

	<a class="btn btn-primary btn-block" href="/ledger/new">+ Create a new ledger</a>
	<a class="btn btn-block" href="/ledger/join">Join with a code</a>

	<p class="muted" style="margin-top: var(--space-8); font-size: 13px">
		Phase 3 — UI shell on in-memory demo data. No persistence, network or encryption yet.
	</p>
</div>
