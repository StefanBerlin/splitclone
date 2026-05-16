<script lang="ts">
	import { app } from '$lib/ui/stores/app.svelte';
	import type { JoinCodePreview } from '$lib/ui/stores/app.svelte';

	let code = $state('');
	let checking = $state(false);
	let result = $state<JoinCodePreview | undefined>();

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

	<button class="btn btn-primary btn-block" onclick={check} disabled={!code.trim() || checking}>
		{checking ? 'Checking…' : 'Validate code'}
	</button>

	{#if result?.ok}
		<div class="card ok">
			✓ Valid join code. It unlocks the ledger whose key fingerprint is:
			<code>{result.fingerprint}</code>
		</div>
	{:else if result}
		<div class="card danger">✗ {result.error}</div>
	{/if}

	<div class="card">
		Fetching and decrypting the shared ledger from OneDrive (and the fingerprint check against the
		ledger's metadata, SC-ARC-ENC-3) is wired up in Phase 6. This screen currently confirms only
		that the code is well-formed and shows which key it carries — see <code
			>docs/mockups/11-join-ledger.md</code
		> for the full intended flow (QR scan, fingerprint check, participant claim).
	</div>
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
