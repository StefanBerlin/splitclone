<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import { splitEqually, resolveLabelNames } from '$lib/domain';
	import { euro, formatDate } from '$lib/ui/format/format';

	const ledgerId = $derived(page.params.ledgerId!);
	const expenseId = $derived(page.params.expenseId!);
	const ledger = $derived(app.derived(ledgerId));
	const e = $derived(ledger.expenses.get(expenseId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	const shares = $derived(
		e
			? splitEqually({
					amount: e.amount,
					splitParticipantIds: e.splitParticipantIds,
					payerId: e.payerId
				})
			: new Map<string, bigint>()
	);
	const base = $derived(
		e && e.splitParticipantIds.length ? e.amount / BigInt(e.splitParticipantIds.length) : 0n
	);

	function name(id: string): string {
		const n = ledger.participants.get(id)?.name ?? id;
		return id === meId ? `${n} (you)` : n;
	}

	function remove() {
		if (!confirm('Delete this expense? It disappears for everyone after sync.')) return;
		app.dispatch(ledgerId, 'ExpenseDeleted', { expenseId });
		goto(resolve('/ledger/[ledgerId]', { ledgerId }));
	}
</script>

<div class="topbar">
	<a href={resolve('/ledger/[ledgerId]', { ledgerId })}>‹ Expenses</a>
	<span class="title">Expense details</span>
</div>

<div class="screen">
	{#if !e}
		<div class="empty">This expense was deleted or never existed.</div>
	{:else}
		<h2 style="margin:0 0 var(--space-1)">{e.title}</h2>
		<p class="amount" style="font-size:28px">{euro(e.amount)}</p>
		<p class="muted">{formatDate(e.executionDate)}</p>

		<p class="section-head">Paid by</p>
		<p>{name(e.payerId)}</p>

		<p class="section-head">
			Split equally · {e.splitParticipantIds.length} ways{#if !e.splitParticipantIds.includes(e.payerId)}
				· payer excluded{/if}
		</p>
		<div class="dl">
			{#each [...shares.entries()] as [pid, share] (pid)}
				<dt>{name(pid)}</dt>
				<dd>
					{euro(share)}{#if share !== base}
						<span class="muted">(+{euro(share - base)} remainder)</span>{/if}
				</dd>
			{/each}
		</div>

		{#if resolveLabelNames(ledger, e).length}
			<p class="section-head">Labels</p>
			<p>{resolveLabelNames(ledger, e).join(' · ')}</p>
		{/if}

		{#if e.note}
			<p class="section-head">Note</p>
			<p>{e.note}</p>
		{/if}

		<p class="muted" style="font-size:13px; margin-top:var(--space-6)">
			Created by {name(e.createdBy)} · {e.createdAt.slice(0, 16).replace('T', ' ')}
			{#if e.lastEditedAt}<br />Last edited {e.lastEditedAt.slice(0, 16).replace('T', ' ')} by {name(
					e.lastEditedBy ?? ''
				)}{/if}
		</p>

		<div style="display:flex; gap:var(--space-3); margin-top:var(--space-6)">
			<a
				class="btn btn-primary"
				href={resolve('/ledger/[ledgerId]/expense/[expenseId]/edit', { ledgerId, expenseId })}
				>Edit</a
			>
			<button class="btn btn-danger" onclick={remove}>🗑 Delete</button>
		</div>
	{/if}
</div>
