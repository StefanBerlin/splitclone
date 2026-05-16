<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';
	import { parseMoney } from '$lib/domain';
	import { euro } from '$lib/ui/format/format';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));
	const q = $derived(page.url.searchParams);

	let from = $state('');
	let to = $state('');
	let amountText = $state('');
	let date = $state(new Date().toISOString().slice(0, 10));
	let note = $state('');
	let error = $state('');

	// Prefill from deep link (Balances "settle up"), else sensible defaults.
	$effect(() => {
		if (!from) from = q.get('from') ?? meId ?? '';
		if (!to) {
			const other = [...ledger.participants.keys()].find((p) => p !== from);
			to = q.get('to') ?? other ?? '';
		}
		if (!amountText && q.get('amount')) {
			const cents = BigInt(q.get('amount')!);
			amountText = `${(cents / 100n).toString()}.${(cents % 100n).toString().padStart(2, '0')}`;
		}
	});

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

	function save() {
		if (!canSave || parsed === null) {
			error = from === to ? 'From and To must be different people.' : 'Enter a valid amount.';
			return;
		}
		app.dispatch(ledgerId, 'SettlementRecorded', {
			settlementId: crypto.randomUUID(),
			input: {
				fromParticipantId: from,
				toParticipantId: to,
				amount: parsed,
				date,
				note: note.trim() || undefined
			}
		});
		goto(`/ledger/${ledgerId}/balances`);
	}

	function label(id: string): string {
		const n = ledger.participants.get(id)?.name ?? id;
		return id === meId ? `${n} (you)` : n;
	}
</script>

<svelte:head><title>Record settlement</title></svelte:head>

<div class="topbar">
	<a href="/ledger/{ledgerId}/balances">‹ Cancel</a>
	<span class="title">Record settlement</span>
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

	<p class="muted" style="font-size:13px">
		ℹ Settlements record real money moving between two people. They only affect the balance between
		those two (SC-FR-BAL-4).
	</p>
</div>
