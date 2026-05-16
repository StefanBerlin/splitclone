<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';
	import { parseMoney, splitEqually, type ExpenseInput } from '$lib/domain';
	import { euro } from '$lib/ui/format/format';

	let { ledgerId, expenseId }: { ledgerId: string; expenseId?: string } = $props();

	// Reactive views used by the template (participant/label lists stay live).
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	// One-time snapshot for form initialisation. untrack() makes the
	// intentional non-reactive read explicit: the form opens against the
	// value at open time and does not live-rebind if the store changes
	// underneath it (a fresh route mount handles new/edit transitions).
	const snap = untrack(() => app.derived(ledgerId));
	const editing = untrack(() => (expenseId ? snap.expenses.get(expenseId) : undefined));
	const initialMeId = untrack(() => app.claimedParticipantId(ledgerId));

	const today = new Date().toISOString().slice(0, 10);

	let title = $state(editing?.title ?? '');
	let amountText = $state(editing ? centsToText(editing.amount) : '');
	let executionDate = $state(editing?.executionDate ?? today);
	let payerId = $state(editing?.payerId ?? initialMeId ?? '');
	let splitIds = $state<string[]>(
		editing ? [...editing.splitParticipantIds] : [...snap.participants.keys()]
	);
	let labelIds = $state<string[]>(editing ? [...editing.labelIds] : []);
	let note = $state(editing?.note ?? '');
	let error = $state('');

	function centsToText(c: bigint): string {
		const neg = c < 0n;
		const s = (neg ? -c : c).toString().padStart(3, '0');
		return `${s.slice(0, -2)}.${s.slice(-2)}`;
	}

	let parsedAmount = $derived.by(() => {
		try {
			return amountText.trim() ? parseMoney(amountText.trim()) : 0n;
		} catch {
			return null; // invalid
		}
	});

	const canSave = $derived(
		title.trim().length > 0 &&
			parsedAmount !== null &&
			parsedAmount > 0n &&
			splitIds.length > 0 &&
			payerId !== ''
	);

	const preview = $derived.by(() => {
		if (parsedAmount === null || parsedAmount <= 0n || splitIds.length === 0) {
			return null;
		}
		return splitEqually({
			amount: parsedAmount,
			splitParticipantIds: splitIds,
			payerId
		});
	});

	function toggle(list: string[], id: string): string[] {
		return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	function save() {
		if (!canSave || parsedAmount === null) {
			error = 'Check the title, amount and split.';
			return;
		}
		const input: ExpenseInput = {
			title: title.trim(),
			amount: parsedAmount,
			executionDate,
			payerId,
			splitParticipantIds: splitIds,
			labelIds,
			note: note.trim() || undefined
		};
		if (expenseId) {
			app.dispatch(ledgerId, 'ExpenseUpdated', { expenseId, input });
			goto(`/ledger/${ledgerId}/expense/${expenseId}`);
		} else {
			app.dispatch(ledgerId, 'ExpenseCreated', {
				expenseId: crypto.randomUUID(),
				input
			});
			goto(`/ledger/${ledgerId}`);
		}
	}

	function remove() {
		if (!expenseId) return;
		if (!confirm('Delete this expense? It disappears for everyone after sync.')) return;
		app.dispatch(ledgerId, 'ExpenseDeleted', { expenseId });
		goto(`/ledger/${ledgerId}`);
	}

	function name(id: string): string {
		return ledger.participants.get(id)?.name ?? id;
	}
</script>

<div class="topbar">
	<a href={expenseId ? `/ledger/${ledgerId}/expense/${expenseId}` : `/ledger/${ledgerId}`}
		>‹ Cancel</a
	>
	<span class="title">{expenseId ? 'Edit expense' : 'New expense'}</span>
	<button onclick={save} disabled={!canSave}>Save</button>
</div>

<div class="screen">
	{#if error}<p class="neg">{error}</p>{/if}

	<label class="field">
		<span>Title</span>
		<input bind:value={title} placeholder="e.g. Groceries (REWE)" />
	</label>

	<label class="field">
		<span>Amount (€)</span>
		<input bind:value={amountText} inputmode="decimal" placeholder="0.00" />
		{#if amountText.trim() && parsedAmount === null}
			<span class="neg" style="font-size:13px">Enter a valid amount like 12.50</span>
		{/if}
	</label>

	<label class="field">
		<span>Date it happened</span>
		<input type="date" bind:value={executionDate} />
	</label>

	<label class="field">
		<span>Paid by</span>
		<select bind:value={payerId}>
			{#each [...ledger.participants.values()] as p (p.id)}
				<option value={p.id}>{p.id === meId ? `${p.name} (you)` : p.name}</option>
			{/each}
		</select>
	</label>

	<div class="field">
		<span class="muted" style="font-size:13px">Split among</span>
		<div class="chip-row">
			{#each [...ledger.participants.values()] as p (p.id)}
				<button
					class="chip"
					aria-pressed={splitIds.includes(p.id)}
					onclick={() => (splitIds = toggle(splitIds, p.id))}>{p.name}</button
				>
			{/each}
		</div>
		{#if preview}
			<p class="muted" style="font-size:13px">
				{#each [...preview.entries()] as [pid, share] (pid)}
					{name(pid)}
					{euro(share)}{#if pid !== [...preview.keys()].at(-1)}
						·
					{/if}
				{/each}
			</p>
		{/if}
	</div>

	<div class="field">
		<span class="muted" style="font-size:13px">Labels (optional)</span>
		<div class="chip-row">
			{#each [...ledger.labels.values()] as l (l.id)}
				<button
					class="chip"
					aria-pressed={labelIds.includes(l.id)}
					onclick={() => (labelIds = toggle(labelIds, l.id))}>{l.name}</button
				>
			{/each}
			{#if ledger.labels.size === 0}<span class="muted">No labels yet</span>{/if}
		</div>
	</div>

	<label class="field">
		<span>Note (optional)</span>
		<textarea bind:value={note} rows="3"></textarea>
	</label>

	{#if editing}
		<button class="btn btn-danger btn-block" onclick={remove}>🗑 Delete this expense</button>
		<p class="muted" style="font-size:13px">
			Created by {name(editing.createdBy)} · {editing.createdAt.slice(0, 16).replace('T', ' ')}
			{#if editing.lastEditedAt}<br />Last edited {editing.lastEditedAt
					.slice(0, 16)
					.replace('T', ' ')}{/if}
		</p>
	{/if}
</div>
