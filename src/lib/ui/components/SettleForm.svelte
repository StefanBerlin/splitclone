<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import { parseMoney } from '$lib/domain';
	import { euro } from '$lib/ui/format/format';

	let { ledgerId, settlementId }: { ledgerId: string; settlementId?: string } = $props();

	// Reactive views for the template (participant list stays live).
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	// One-time snapshot for initialisation (see ExpenseForm for rationale).
	const snap = untrack(() => app.derived(ledgerId));
	const editing = untrack(() => (settlementId ? snap.settlements.get(settlementId) : undefined));
	const q = untrack(() => page.url.searchParams);

	function centsToText(c: bigint): string {
		const s = (c < 0n ? -c : c).toString().padStart(3, '0');
		return `${s.slice(0, -2)}.${s.slice(-2)}`;
	}

	const initialMe = untrack(() => app.claimedParticipantId(ledgerId));
	const otherDefault = untrack(
		() => [...snap.participants.keys()].find((p) => p !== (q.get('from') ?? initialMe)) ?? ''
	);

	let from = $state(editing?.fromParticipantId ?? q.get('from') ?? initialMe ?? '');
	let to = $state(editing?.toParticipantId ?? q.get('to') ?? otherDefault);
	let amountText = $state(
		editing
			? centsToText(editing.amount)
			: q.get('amount')
				? centsToText(BigInt(q.get('amount')!))
				: ''
	);
	let date = $state(editing?.date ?? new Date().toISOString().slice(0, 10));
	let note = $state(editing?.note ?? '');
	let error = $state('');

	let parsed = $derived.by(() => {
		try {
			return amountText.trim() ? parseMoney(amountText.trim()) : 0n;
		} catch {
			return null;
		}
	});
	const canSave = $derived(
		from !== '' && to !== '' && from !== to && parsed !== null && parsed > 0n
	);

	const backHref = $derived(
		settlementId
			? resolve('/ledger/[ledgerId]', { ledgerId })
			: resolve('/ledger/[ledgerId]/balances', { ledgerId })
	);

	function save() {
		if (!canSave || parsed === null) {
			error = from === to ? 'From and To must be different people.' : 'Enter a valid amount.';
			return;
		}
		const input = {
			fromParticipantId: from,
			toParticipantId: to,
			amount: parsed,
			date,
			note: note.trim() || undefined
		};
		if (settlementId) {
			app.dispatch(ledgerId, 'SettlementUpdated', { settlementId, input });
		} else {
			app.dispatch(ledgerId, 'SettlementRecorded', {
				settlementId: crypto.randomUUID(),
				input
			});
		}
		goto(
			settlementId
				? resolve('/ledger/[ledgerId]', { ledgerId })
				: resolve('/ledger/[ledgerId]/balances', { ledgerId })
		);
	}

	function remove() {
		if (!settlementId) return;
		if (!confirm('Delete this settlement? It disappears for everyone after sync.')) return;
		app.dispatch(ledgerId, 'SettlementDeleted', { settlementId });
		goto(resolve('/ledger/[ledgerId]', { ledgerId }));
	}

	function label(id: string): string {
		const n = ledger.participants.get(id)?.name ?? id;
		return id === meId ? `${n} (you)` : n;
	}
</script>

<svelte:head><title>{settlementId ? 'Edit settlement' : 'Record settlement'}</title></svelte:head>

<div class="topbar">
	<a href={backHref}>‹ Cancel</a>
	<span class="title">{settlementId ? 'Edit settlement' : 'Record settlement'}</span>
	<button onclick={save} disabled={!canSave}>Save</button>
</div>

<div class="screen">
	{#if error}<p class="neg">{error}</p>{/if}

	<label class="field">
		<span>From</span>
		<select bind:value={from}>
			{#each [...ledger.participants.values()] as p (p.id)}
				<option value={p.id}>{label(p.id)}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>To</span>
		<select bind:value={to}>
			{#each [...ledger.participants.values()] as p (p.id)}
				<option value={p.id}>{label(p.id)}</option>
			{/each}
		</select>
	</label>

	<label class="field">
		<span>Amount (€)</span>
		<input bind:value={amountText} inputmode="decimal" placeholder="0.00" />
		{#if parsed && parsed > 0n}<span class="muted" style="font-size:13px">{euro(parsed)}</span>{/if}
	</label>

	<label class="field">
		<span>Date</span>
		<input type="date" bind:value={date} />
	</label>

	<label class="field">
		<span>Note (optional)</span>
		<input bind:value={note} placeholder="e.g. Cash, PayPal" />
	</label>

	{#if editing}
		<button class="btn btn-danger btn-block" onclick={remove}>🗑 Delete this settlement</button>
		<p class="muted" style="font-size:13px">
			Recorded by {label(editing.createdBy)} · {editing.createdAt.slice(0, 16).replace('T', ' ')}
			{#if editing.lastEditedAt}<br />Last edited {editing.lastEditedAt
					.slice(0, 16)
					.replace('T', ' ')}{/if}
		</p>
	{:else}
		<p class="muted" style="font-size:13px">
			ℹ Settlements record real money moving between two people. They only affect the balance
			between those two (SC-FR-BAL-4).
		</p>
	{/if}
</div>
