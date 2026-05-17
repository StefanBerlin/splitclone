<!--
  SC-FR-PRT-2: first time this device opens a ledger it joined, the user must
  bind to a participant — either claim an existing unclaimed entry (a) or
  create a new one (b). Blocks ledger access until done, because dispatching
  before a claim would author events as the unknown participant.
-->
<script lang="ts">
	import { app } from '$lib/ui/stores/app.svelte';

	let { ledgerId, ledgerName }: { ledgerId: string; ledgerName: string } = $props();

	const candidates = $derived(app.unclaimedParticipantList(ledgerId));
	let mode = $state<'pick' | 'create'>('pick');
	let newName = $state('');

	$effect(() => {
		// No one to claim → go straight to "add yourself".
		if (candidates.length === 0) mode = 'create';
	});

	function claim(id: string) {
		app.claimParticipant(ledgerId, id);
	}
	function createAndClaim() {
		const name = newName.trim();
		if (!name) return;
		app.addAndClaimParticipant(ledgerId, name);
	}
</script>

<div class="screen claim">
	<h1>Who are you in “{ledgerName}”?</h1>
	<p class="muted">
		This device isn’t linked to anyone in this ledger yet. Pick your name, or add yourself.
	</p>

	{#if mode === 'pick' && candidates.length > 0}
		<ul class="people">
			{#each candidates as p (p.id)}
				<li>
					<button class="btn btn-block" onclick={() => claim(p.id)}>{p.name}</button>
				</li>
			{/each}
		</ul>
		<button class="link" onclick={() => (mode = 'create')}>None of these — add me</button>
	{:else}
		<label class="field">
			<span>Your name</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={newName}
				placeholder="e.g. Alex"
				autofocus
				onkeydown={(e) => e.key === 'Enter' && createAndClaim()}
			/>
		</label>
		<button class="btn btn-primary btn-block" disabled={!newName.trim()} onclick={createAndClaim}>
			Join as “{newName.trim() || '…'}”
		</button>
		{#if candidates.length > 0}
			<button class="link" onclick={() => (mode = 'pick')}>← Back to the list</button>
		{/if}
	{/if}
</div>

<style>
	.claim {
		display: flex;
		flex-direction: column;
		gap: var(--space-3, 16px);
		padding: var(--space-4, 24px);
	}
	.claim h1 {
		font-size: 1.25rem;
		margin: 0;
	}
	.muted {
		color: var(--text-muted, #666);
		font-size: 0.9rem;
		margin: 0;
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 8px);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field span {
		font-size: 0.85rem;
		color: var(--text-muted, #666);
	}
	.field input {
		padding: 10px 12px;
		font-size: 1rem;
		border: 1px solid var(--border, #ccc);
		border-radius: 8px;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent, #0a6);
		text-decoration: underline;
		cursor: pointer;
		font-size: 0.9rem;
		align-self: flex-start;
		padding: 0;
	}
</style>
