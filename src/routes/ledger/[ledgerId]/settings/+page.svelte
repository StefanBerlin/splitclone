<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	let nameField = $state('');
	$effect(() => {
		if (nameField === '') nameField = ledger.ledgerName;
	});

	function saveName() {
		const n = nameField.trim();
		if (n && n !== ledger.ledgerName) {
			app.dispatch(ledgerId, 'LedgerRenamed', { name: n });
		}
	}

	function addParticipant() {
		const name = prompt('New participant name')?.trim();
		if (name) {
			app.dispatch(ledgerId, 'ParticipantAdded', {
				participantId: crypto.randomUUID(),
				name
			});
		}
	}

	function renameParticipant(id: string, current: string) {
		const name = prompt('Rename participant', current)?.trim();
		if (name && name !== current) {
			app.dispatch(ledgerId, 'ParticipantRenamed', { participantId: id, name });
		}
	}

	function claimState(p: { id: string; claimedByDeviceId?: string }): string {
		if (!p.claimedByDeviceId) return 'not yet claimed';
		return p.claimedByDeviceId === app.deviceId
			? 'claimed on this device'
			: 'claimed on another device';
	}

	let theme = $state<'system' | 'light' | 'dark'>('system');
	function applyTheme() {
		const el = document.documentElement;
		if (theme === 'system') delete el.dataset.theme;
		else el.dataset.theme = theme;
	}

	function forget() {
		if (
			!confirm('Forget this ledger on this device? Local data only — nothing is deleted remotely.')
		)
			return;
		app.removeLedger(ledgerId);
		goto('/');
	}
</script>

<svelte:head><title>Ledger settings</title></svelte:head>

<div class="topbar">
	<a href="/ledger/{ledgerId}">‹ {ledger.ledgerName}</a>
	<span class="title">Ledger settings</span>
</div>

<div class="screen">
	<p class="section-head">Ledger</p>
	<label class="field">
		<span>Name</span>
		<input bind:value={nameField} onblur={saveName} />
	</label>
	<div class="dl">
		<dt>Currency</dt>
		<dd>EUR</dd>
		<dt>Schema version</dt>
		<dd>1</dd>
		<dt>Ledger ID</dt>
		<dd style="font-size:13px">{ledgerId}</dd>
	</div>

	<p class="section-head">Sync</p>
	<p>☁ In sync — local demo data (no network until Phase 6).</p>

	<p class="section-head">Sharing</p>
	<p class="muted" style="font-size:13px">
		The recovery code and OneDrive folder sharing are implemented in Phases 5–6. See <code
			>docs/mockups/10-create-ledger.md</code
		>.
	</p>

	<p class="section-head">Participants</p>
	{#each [...ledger.participants.values()] as p (p.id)}
		<div class="row">
			<span class="grow">
				{p.name}{#if p.id === meId}
					<span class="muted">(you)</span>{/if}<br />
				<span class="muted">{claimState(p)}</span>
			</span>
			<button class="chip" onclick={() => renameParticipant(p.id, p.name)}>Rename</button>
		</div>
	{/each}
	<button class="btn btn-block" style="margin-top:var(--space-3)" onclick={addParticipant}
		>+ Add a participant</button
	>

	<p class="section-head">This device</p>
	<label class="field">
		<span>Theme</span>
		<select bind:value={theme} onchange={applyTheme}>
			<option value="system">System</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</label>

	<button class="btn btn-danger btn-block" style="margin-top:var(--space-6)" onclick={forget}>
		Forget this ledger on this device
	</button>
	<p class="muted" style="font-size:13px">
		Removes only the local copy. In later phases the OneDrive data is left untouched and can be
		rejoined with the recovery code.
	</p>
</div>
