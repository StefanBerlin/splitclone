<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';
	import RecoveryCode from '$lib/ui/components/RecoveryCode.svelte';

	let step = $state<'settings' | 'recovery'>('settings');
	let name = $state('');
	let yourName = $state('');
	let creating = $state(false);
	let createdId = $state('');
	let acknowledged = $state(false);

	const canCreate = $derived(name.trim().length > 0 && yourName.trim().length > 0);
	const code = $derived(createdId ? app.joinCodeFor(createdId) : undefined);

	async function create() {
		if (!canCreate || creating) return;
		creating = true;
		try {
			createdId = await app.createLedger(name.trim(), yourName.trim());
			step = 'recovery';
		} finally {
			creating = false;
		}
	}

	function done() {
		if (!acknowledged || !createdId) return;
		app.acknowledgeRecovery(createdId);
		goto(`/ledger/${createdId}`);
	}
</script>

<svelte:head><title>New ledger</title></svelte:head>

{#if step === 'settings'}
	<div class="topbar">
		<a href="/">‹ Cancel</a>
		<span class="title">New ledger</span>
		<button onclick={create} disabled={!canCreate || creating}>
			{creating ? 'Creating…' : 'Create'}
		</button>
	</div>

	<div class="screen">
		<label class="field">
			<span>Name</span>
			<input bind:value={name} placeholder="e.g. Flatshare — Berlin" />
		</label>

		<label class="field">
			<span>Your display name</span>
			<input bind:value={yourName} placeholder="e.g. Stefan" />
		</label>

		<label class="field">
			<span>Currency</span>
			<select disabled><option>EUR — Euro</option></select>
		</label>

		<div class="card">
			🔒 All ledger contents are encrypted at rest with a key generated on this device
			(AES-256-GCM). The next step shows your recovery code — save it. The OneDrive folder picker
			arrives in Phase 6; for now the ledger lives only in this browser.
		</div>
	</div>
{:else}
	<div class="topbar">
		<span></span>
		<span class="title">Save your recovery code</span>
		<button onclick={done} disabled={!acknowledged}>Done</button>
	</div>

	<div class="screen">
		<div class="card danger">
			⚠ This code is the ONLY way to add new devices or recover access if this device is lost.
			SplitClone has no servers and cannot reset it for you.
		</div>

		{#if code}
			<RecoveryCode {code} ledgerName={name.trim()} />
		{:else}
			<p class="muted">Generating recovery code…</p>
		{/if}

		<label class="ack">
			<input type="checkbox" bind:checked={acknowledged} />
			<span>I have saved the recovery code in a safe place outside this device.</span>
		</label>
	</div>
{/if}

<style>
	.card.danger {
		border-color: var(--danger, #b00020);
		color: var(--danger, #b00020);
	}
	.ack {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 0.9rem;
		padding: 4px 0;
	}
	.ack input {
		margin-top: 3px;
	}
</style>
