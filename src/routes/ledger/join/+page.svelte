<script lang="ts">
	import { goto } from '$app/navigation';
	import { app } from '$lib/ui/stores/app.svelte';
	import type { JoinCodePreview } from '$lib/ui/stores/app.svelte';

	let code = $state('');
	let checking = $state(false);
	let result = $state<JoinCodePreview | undefined>();
	let joinError = $state('');

	const canJoinRemote = $derived(app.oneDriveConfigured && app.connected);

	async function check() {
		if (!code.trim() || checking) return;
		checking = true;
		result = undefined;
		try {
			result = await app.previewJoinCode(code);
		} finally {
			checking = false;
		}
	}

	async function joinRemote() {
		if (!code.trim() || checking) return;
		checking = true;
		joinError = '';
		try {
			const r = await app.joinViaOneDrive(code);
			if (r.ok && r.ledgerId) goto(`/ledger/${r.ledgerId}`);
			else joinError = r.error ?? 'Could not join.';
		} finally {
			checking = false;
		}
	}
</script>

<svelte:head><title>Join a ledger</title></svelte:head>

<div class="topbar">
	<a href="/">‹ Cancel</a>
	<span class="title">Join a ledger</span>
	<span></span>
</div>

<div class="screen">
	<p class="muted">
		Ask the ledger owner to show you their recovery code, then paste it here. The code is checked on
		this device only — it is never sent anywhere.
	</p>

	<label class="field">
		<span>Recovery code</span>
		<input bind:value={code} placeholder="SC1.…" autocomplete="off" spellcheck="false" />
	</label>

	{#if canJoinRemote}
		<button
			class="btn btn-primary btn-block"
			onclick={joinRemote}
			disabled={!code.trim() || checking}
		>
			{checking ? 'Joining…' : 'Join from OneDrive'}
		</button>
		<button
			class="btn btn-block"
			style="margin-top:var(--space-2)"
			onclick={check}
			disabled={!code.trim() || checking}
		>
			Validate only
		</button>
		{#if joinError}
			<div class="card danger">✗ {joinError}</div>
		{/if}
	{:else}
		<button class="btn btn-primary btn-block" onclick={check} disabled={!code.trim() || checking}>
			{checking ? 'Checking…' : 'Validate code'}
		</button>
	{/if}

	{#if result?.ok}
		<div class="card ok">
			✓ Valid join code. It unlocks the ledger whose key fingerprint is:
			<code>{result.fingerprint}</code>
		</div>
	{:else if result}
		<div class="card danger">✗ {result.error}</div>
	{/if}

	{#if !app.oneDriveConfigured}
		<div class="card">
			OneDrive is not configured in this build, so this screen only validates the code locally. With
			OneDrive enabled and connected, joining scans folders shared with your account and adopts the
			one whose metadata fingerprint matches (SC-ARC-ENC-3).
		</div>
	{:else if !app.connected}
		<div class="card">
			<a href="/auth/start">Connect OneDrive</a> to actually join a shared ledger. The owner must have
			shared its folder with your Microsoft account first.
		</div>
	{/if}
</div>

<style>
	.card.ok {
		border-color: var(--ok, #1a7f37);
		color: var(--ok, #1a7f37);
	}
	.card.ok code {
		display: block;
		margin-top: 6px;
		word-break: break-all;
		font-family: ui-monospace, monospace;
	}
	.card.danger {
		border-color: var(--danger, #b00020);
		color: var(--danger, #b00020);
	}
</style>
