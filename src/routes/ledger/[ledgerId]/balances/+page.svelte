<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import { balancesFor } from '$lib/domain';
	import { euro } from '$lib/ui/format/format';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	const entries = $derived(meId ? balancesFor(ledger, meId) : []);
	const youOwe = $derived(entries.filter((e) => e.amount > 0n));
	const owedToYou = $derived(entries.filter((e) => e.amount < 0n));
	const net = $derived(entries.reduce((s, e) => s - e.amount, 0n));

	function name(id: string): string {
		return ledger.participants.get(id)?.name ?? id;
	}
	function settleHref(other: string, amount: bigint): string {
		const abs = amount < 0n ? -amount : amount;
		// You owe -> you pay them; they owe you -> they pay you.
		const [from, to] = amount > 0n ? [meId, other] : [other, meId];
		return `/ledger/${ledgerId}/settle/new?from=${from}&to=${to}&amount=${abs}`;
	}
</script>

<svelte:head><title>Balances</title></svelte:head>

<div class="screen">
	{#if !meId}
		<div class="empty">No participant is claimed on this device.</div>
	{:else if entries.length === 0}
		<div class="empty">
			<p style="font-size:28px">✓</p>
			<p>All settled up.</p>
			<a class="btn" href="/ledger/{ledgerId}/settle/new">+ Record settlement</a>
		</div>
	{:else}
		{#if youOwe.length}
			<p class="section-head">You owe</p>
			{#each youOwe as b (b.participantId)}
				<a class="row" href={settleHref(b.participantId, b.amount)}>
					<span class="grow">{name(b.participantId)}</span>
					<span class="amount neg">{euro(b.amount)}</span>
				</a>
			{/each}
		{/if}

		{#if owedToYou.length}
			<p class="section-head">You are owed</p>
			{#each owedToYou as b (b.participantId)}
				<a class="row" href={settleHref(b.participantId, b.amount)}>
					<span class="grow">{name(b.participantId)}</span>
					<span class="amount pos">{euro(-b.amount)}</span>
				</a>
			{/each}
		{/if}

		<p class="section-head">Net</p>
		<p class="amount" class:pos={net > 0n} class:neg={net < 0n}>
			{net > 0n ? 'You are owed ' : net < 0n ? 'You owe ' : 'Even: '}{euro(net < 0n ? -net : net)}
		</p>

		<a class="btn btn-block" href="/ledger/{ledgerId}/settle/new" style="margin-top:var(--space-6)"
			>+ Record settlement</a
		>
	{/if}
</div>
