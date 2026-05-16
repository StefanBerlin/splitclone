<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';
	import RecoveryCode from '$lib/ui/components/RecoveryCode.svelte';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));
	const code = $derived(app.joinCodeFor(ledgerId));
	const fingerprint = $derived(app.keyFingerprintFor(ledgerId));
	let showRecovery = $state(false);

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
	{#if !app.oneDriveConfigured}
		<p class="muted" style="font-size:13px">
			OneDrive is not configured in this build. The ledger lives only in this browser. See
			<code>.env.example</code> to enable cloud sync.
		</p>
	{:else if !app.connected}
		<p class="muted" style="font-size:13px">
			Not connected. Connect OneDrive to sync this ledger across devices and share it with others.
		</p>
		<a class="btn btn-primary btn-block" href="/auth/start">☁ Connect OneDrive</a>
	{:else}
		<p>
			{#if app.syncState === 'syncing'}
				⏳ Syncing…
			{:else if app.syncState === 'error'}
				⚠ Sync error: <span class="muted">{app.syncError}</span>
			{:else}
				☁ Connected.
			{/if}
		</p>
		<button
			class="btn btn-block"
			onclick={() => app.syncNow(ledgerId)}
			disabled={app.syncState === 'syncing'}
		>
			Sync now
		</button>
		<button class="btn btn-block" style="margin-top:var(--space-2)" onclick={() => app.signOut()}>
			Disconnect OneDrive
		</button>
	{/if}

	<p class="section-head">Sharing &amp; recovery</p>
	{#if code}
		<div class="dl">
			<dt>Key fingerprint</dt>
			<dd style="font-size:13px;word-break:break-all">{fingerprint}</dd>
		</div>
		{#if showRecovery}
			<RecoveryCode {code} ledgerName={ledger.ledgerName} />
			<button class="btn btn-block" onclick={() => (showRecovery = false)}>Hide code</button>
		{:else}
			<button class="btn btn-block" onclick={() => (showRecovery = true)}>
				Show recovery code
			</button>
		{/if}
		<p class="muted" style="font-size:13px">
			Anyone joining this ledger uses this code. OneDrive folder sharing arrives in Phase 6.
		</p>
	{:else}
		<p class="muted" style="font-size:13px">No data key on this device for this ledger.</p>
	{/if}

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
