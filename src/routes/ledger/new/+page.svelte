<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';

	let name = $state('');
	let yourName = $state('');
	const canCreate = $derived(name.trim().length > 0 && yourName.trim().length > 0);

	function create() {
		if (!canCreate) return;
		const id = app.createLedger(name.trim(), yourName.trim());
		goto(`/ledger/${id}`);
	}
</script>

<svelte:head><title>New ledger</title></svelte:head>

<div class="topbar">
	<a href="/">‹ Cancel</a>
	<span class="title">New ledger</span>
	<button onclick={create} disabled={!canCreate}>Create</button>
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
		🔒 All ledger contents will be encrypted at rest in OneDrive. The recovery-code step and the
		OneDrive folder picker arrive in later phases (5–6); for now the ledger lives only in this
		browser session.
	</div>
</div>
