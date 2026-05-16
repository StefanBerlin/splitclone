<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import { listExpenses, resolveLabelNames } from '$lib/domain';
	import type { Expense, Settlement } from '$lib/domain';
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

	type Row =
		| { kind: 'expense'; date: string; tie: string; e: Expense }
		| { kind: 'settlement'; date: string; tie: string; s: Settlement };

	const rows = $derived.by<Row[]>(() => {
		const out: Row[] = [];

		for (const e of listExpenses(ledger)) {
			if (
				filterParticipant &&
				e.payerId !== filterParticipant &&
				!e.splitParticipantIds.includes(filterParticipant)
			) {
				continue;
			}
			if (activeLabels.length > 0 && !e.labelIds.some((l) => activeLabels.includes(l))) {
				continue;
			}
			if (from && e.executionDate < from) continue;
			if (to && e.executionDate > to) continue;
			out.push({ kind: 'expense', date: e.executionDate, tie: e.createdAt, e });
		}

		// Settlements carry no labels, so a label filter excludes them.
		if (activeLabels.length === 0) {
			for (const s of ledger.settlements.values()) {
				if (
					filterParticipant &&
					s.fromParticipantId !== filterParticipant &&
					s.toParticipantId !== filterParticipant
				) {
					continue;
				}
				if (from && s.date < from) continue;
				if (to && s.date > to) continue;
				out.push({ kind: 'settlement', date: s.date, tie: s.createdAt, s });
			}
		}

		return out.sort((a, b) =>
			a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.tie < b.tie ? 1 : -1
		);
	});

	const expenseCount = $derived(rows.filter((r) => r.kind === 'expense').length);
	const settlementCount = $derived(rows.length - expenseCount);
	const total = $derived(rows.reduce((s, r) => (r.kind === 'expense' ? s + r.e.amount : s), 0n));

	function pname(id: string): string {
		if (id === meId) return 'you';
		return ledger.participants.get(id)?.name ?? id;
	}

	const groups = $derived(
		rows.reduce<{ date: string; items: Row[] }[]>((acc, r) => {
			const last = acc.at(-1);
			if (last && last.date === r.date) last.items.push(r);
			else acc.push({ date: r.date, items: [r] });
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
		<p class="muted">
			{expenseCount} expenses · {euro(total)} total{#if settlementCount}
				· {settlementCount} settlements{/if}
		</p>
	{/if}

	{#if rows.length === 0}
		<div class="empty">
			<p>No matching items.</p>
			{#if filtersActive}<p>Try widening a filter above.</p>{/if}
		</div>
	{:else}
		{#each groups as g (g.date)}
			<p class="section-head">{dateGroupLabel(g.date)}</p>
			{#each g.items as r (r.kind + (r.kind === 'expense' ? r.e.id : r.s.id))}
				{#if r.kind === 'expense'}
					<a class="row" href="/ledger/{ledgerId}/expense/{r.e.id}">
						<span class="grow">
							{r.e.title}<br />
							<span class="muted"
								>paid by {pname(r.e.payerId)} · split {r.e.splitParticipantIds.length} ways{#if resolveLabelNames(ledger, r.e).length}
									· {resolveLabelNames(ledger, r.e).join(', ')}{/if}</span
							>
						</span>
						<span class="amount neg">{euro(r.e.amount)}</span>
					</a>
				{:else}
					<a class="row" href="/ledger/{ledgerId}/settle/{r.s.id}/edit">
						<span class="grow">
							↔ Settlement<br />
							<span class="muted"
								>{pname(r.s.fromParticipantId)} → {pname(r.s.toParticipantId)}{#if r.s.note}
									· {r.s.note}{/if}</span
							>
						</span>
						<span class="amount">{euro(r.s.amount)}</span>
					</a>
				{/if}
			{/each}
		{/each}
	{/if}
</div>

<a class="fab" href="/ledger/{ledgerId}/expense/new" aria-label="New expense">+</a>
