<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import { listExpenses, resolveLabelNames } from '$lib/domain';
	import { euro, dateGroupLabel } from '$lib/ui/format/format';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	let filterParticipant = $state('');
	let activeLabels = $state<string[]>([]);
	let from = $state('');
	let to = $state('');

	const filtersActive = $derived(
		filterParticipant !== '' || activeLabels.length > 0 || from !== '' || to !== ''
	);

	function toggleLabel(id: string) {
		activeLabels = activeLabels.includes(id)
			? activeLabels.filter((x) => x !== id)
			: [...activeLabels, id];
	}
	function clearAll() {
		filterParticipant = '';
		activeLabels = [];
		from = '';
		to = '';
	}

	const expenses = $derived(
		listExpenses(ledger).filter((e) => {
			if (filterParticipant) {
				const involved =
					e.payerId === filterParticipant || e.splitParticipantIds.includes(filterParticipant);
				if (!involved) return false;
			}
			if (activeLabels.length > 0 && !e.labelIds.some((l) => activeLabels.includes(l))) {
				return false;
			}
			if (from && e.executionDate < from) return false;
			if (to && e.executionDate > to) return false;
			return true;
		})
	);

	const total = $derived(expenses.reduce((s, e) => s + e.amount, 0n));

	function payerLabel(payerId: string): string {
		if (payerId === meId) return 'you';
		return ledger.participants.get(payerId)?.name ?? payerId;
	}

	// Group consecutive expenses by execution date for section headings.
	const groups = $derived(
		expenses.reduce<{ date: string; items: typeof expenses }[]>((acc, e) => {
			const last = acc.at(-1);
			if (last && last.date === e.executionDate) last.items.push(e);
			else acc.push({ date: e.executionDate, items: [e] });
			return acc;
		}, [])
	);
</script>

<svelte:head><title>{ledger.ledgerName}</title></svelte:head>

<div class="screen">
	<div class="chip-row">
		<select bind:value={filterParticipant} aria-label="Filter by participant" style="width:auto">
			<option value="">All people</option>
			{#each [...ledger.participants.values()] as p (p.id)}
				<option value={p.id}>{p.id === meId ? `${p.name} (you)` : p.name}</option>
			{/each}
		</select>
		{#each [...ledger.labels.values()] as l (l.id)}
			<button
				class="chip"
				aria-pressed={activeLabels.includes(l.id)}
				onclick={() => toggleLabel(l.id)}>{l.name}</button
			>
		{/each}
	</div>
	<div class="chip-row">
		<label class="muted" style="font-size:13px">
			from <input type="date" bind:value={from} style="width:auto" /></label
		>
		<label class="muted" style="font-size:13px">
			to <input type="date" bind:value={to} style="width:auto" /></label
		>
		{#if filtersActive}
			<button class="chip" onclick={clearAll}>Clear all</button>
		{/if}
	</div>

	{#if filtersActive}
		<p class="muted">{expenses.length} expenses · {euro(total)} total</p>
	{/if}

	{#if expenses.length === 0}
		<div class="empty">
			<p>No matching expenses.</p>
			{#if filtersActive}<p>Try widening a filter above.</p>{/if}
		</div>
	{:else}
		{#each groups as g (g.date)}
			<p class="section-head">{dateGroupLabel(g.date)}</p>
			{#each g.items as e (e.id)}
				<a class="row" href="/ledger/{ledgerId}/expense/{e.id}">
					<span class="grow">
						{e.title}<br />
						<span class="muted"
							>paid by {payerLabel(e.payerId)} · split {e.splitParticipantIds.length} ways{#if resolveLabelNames(ledger, e).length}
								· {resolveLabelNames(ledger, e).join(', ')}{/if}</span
						>
					</span>
					<span class="amount neg">{euro(e.amount)}</span>
				</a>
			{/each}
		{/each}
	{/if}
</div>

<a class="fab" href="/ledger/{ledgerId}/expense/new" aria-label="New expense">+</a>
