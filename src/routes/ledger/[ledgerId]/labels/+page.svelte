<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));

	let newName = $state('');

	const labels = $derived(
		[...ledger.labels.values()]
			.map((l) => ({
				...l,
				count: [...ledger.expenses.values()].filter((e) => e.labelIds.includes(l.id)).length
			}))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	);

	function add() {
		const name = newName.trim();
		if (!name) return;
		const dup = [...ledger.labels.values()].some(
			(l) => l.name.toLowerCase() === name.toLowerCase()
		);
		if (dup) {
			alert(`A label "${name}" already exists.`);
			return;
		}
		app.dispatch(ledgerId, 'LabelCreated', { labelId: crypto.randomUUID(), name });
		newName = '';
	}

	function rename(id: string, current: string) {
		const name = prompt('Rename label', current)?.trim();
		if (name && name !== current) {
			app.dispatch(ledgerId, 'LabelRenamed', { labelId: id, name });
		}
	}

	function remove(id: string, name: string, count: number) {
		if (!confirm(`Delete "${name}"? It is removed from ${count} expenses; the expenses stay.`)) {
			return;
		}
		app.dispatch(ledgerId, 'LabelDeleted', { labelId: id });
	}
</script>

<svelte:head><title>Labels</title></svelte:head>

<div class="screen">
	<div class="chip-row">
		<input bind:value={newName} placeholder="New label name" style="flex:1" />
		<button class="btn" onclick={add} disabled={!newName.trim()}>+ Add</button>
	</div>

	{#if labels.length === 0}
		<div class="empty">
			<p>No labels yet.</p>
			<p>Short tags like "food" or "trip-paris" you can attach to expenses.</p>
		</div>
	{:else}
		{#each labels as l (l.id)}
			<div class="row">
				<span class="grow">
					{l.name}<br /><span class="muted">{l.count} expenses</span>
				</span>
				<button class="chip" onclick={() => rename(l.id, l.name)}>Rename</button>
				<button class="chip" onclick={() => remove(l.id, l.name, l.count)}>Delete</button>
			</div>
		{/each}
	{/if}
</div>
