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
	// Same person on a second device (PC + phone): they re-pick the identity
	// they already use elsewhere instead of creating a duplicate (SC-FR-PRT-2).
	const elsewhere = $derived(app.claimedElsewhereList(ledgerId));
	const hasAny = $derived(candidates.length > 0 || elsewhere.length > 0);
	let mode = $state<'pick' | 'create'>('pick');
	let newName = $state('');

	$effect(() => {
		// No one to claim at all → go straight to "add yourself".
		if (!hasAny) mode = 'create';
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

	{#if mode === 'pick' && hasAny}
		{#if candidates.length > 0}
			<ul class="people">
				{#each candidates as p (p.id)}
					<li>
						<button class="btn btn-block" onclick={() => claim(p.id)}>{p.name}</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if elsewhere.length > 0}
			<p class="muted group-head">Already set up on another device</p>
			<p class="muted">
				Using this ledger on a second device? Pick the name you already use — it links this device
				to the same person, it doesn’t create a duplicate.
			</p>
			<ul class="people">
				{#each elsewhere as p (p.id)}
					<li>
						<button class="btn btn-block" onclick={() => claim(p.id)}>{p.name}</button>
					</li>
				{/each}
			</ul>
		{/if}

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
		{#if hasAny}
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
	.group-head {
		margin-top: var(--space-2, 8px);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
