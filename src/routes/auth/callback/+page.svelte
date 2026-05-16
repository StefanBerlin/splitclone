<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { oauthConfig } from '$lib/auth/config';
	import { exchangeCode } from '$lib/auth/pkce';
	import { adoptTokens } from '$lib/auth/token-store';
	import { app } from '$lib/ui/stores/app.svelte';

	let error = $state('');
	let done = $state(false);

	onMount(async () => {
		const cfg = oauthConfig();
		const code = page.url.searchParams.get('code');
		const state = page.url.searchParams.get('state');
		const oauthErr = page.url.searchParams.get('error_description');
		if (oauthErr) {
			error = oauthErr;
			return;
		}
		const verifier = sessionStorage.getItem('pkce_verifier');
		const expected = sessionStorage.getItem('pkce_state');
		sessionStorage.removeItem('pkce_verifier');
		sessionStorage.removeItem('pkce_state');
		if (!cfg || !code || !state || !verifier || state !== expected) {
			error = 'Sign-in could not be verified. Please try connecting again.';
			return;
		}
		try {
			await adoptTokens(await exchangeCode(cfg, code, verifier));
			await app.refreshConnection();
			done = true;
			goto('/');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head><title>Finishing sign-in…</title></svelte:head>

<div class="screen empty">
	{#if error}
		<p>Could not connect to OneDrive:</p>
		<p class="muted">{error}</p>
		<a class="btn" href="/">Back</a>
	{:else if done}
		<p>Connected. Redirecting…</p>
	{:else}
		<p>Finishing sign-in…</p>
	{/if}
</div>
