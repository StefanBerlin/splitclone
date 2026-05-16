<script lang="ts">
	let code = $state('');
</script>

<svelte:head><title>Join a ledger</title></svelte:head>

<div class="topbar">
	<a href="/">‹ Cancel</a>
	<span class="title">Join a ledger</span>
</div>

<div class="screen">
	<p class="muted">Ask the ledger owner to show you their recovery code, then add it here.</p>

	<label class="field">
		<span>Recovery code</span>
		<input bind:value={code} placeholder="SC-…" />
	</label>

	<button class="btn btn-primary btn-block" disabled>Continue</button>

	<div class="card">
		Joining requires decrypting the shared OneDrive folder, which is wired up in Phase 5
		(encryption) and Phase 6 (OneDrive). This screen is a structural placeholder for now — see <code
			>docs/mockups/11-join-ledger.md</code
		> for the full intended flow (QR scan, fingerprint check, participant claim).
	</div>
</div>
