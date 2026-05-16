<script lang="ts">
	import { onMount } from 'svelte';
	import { oauthConfig } from '$lib/auth/config';
	import { buildAuthorizeUrl, createPkcePair, randomState } from '$lib/auth/pkce';

	let error = $state('');

	onMount(async () => {
		const cfg = oauthConfig();
		if (!cfg) {
			error = 'OneDrive is not configured in this build (no client id).';
			return;
		}
		const { verifier, challenge } = await createPkcePair();
		const state = randomState();
		sessionStorage.setItem('pkce_verifier', verifier);
		sessionStorage.setItem('pkce_state', state);
		window.location.assign(buildAuthorizeUrl(cfg, challenge, state));
	});
</script>

<svelte:head><title>Connecting to OneDrive…</title></svelte:head>

<div class="screen empty">
	{#if error}
		<p>{error}</p>
		<a class="btn" href="/">Back</a>
	{:else}
		<p>Redirecting to Microsoft sign-in…</p>
	{/if}
</div>
