<script lang="ts">
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import { getTheme, setTheme, type Theme } from '$lib/ui/theme';

	let theme = $state<Theme>(getTheme());
	function onTheme() {
		setTheme(theme);
	}
</script>

<svelte:head><title>Settings</title></svelte:head>

<div class="topbar">
	<a href={resolve('/')}>‹ Back</a>
	<span class="title">Settings</span>
</div>

<div class="screen">
	<p class="section-head">Appearance</p>
	<label class="field">
		<span>Theme</span>
		<select bind:value={theme} onchange={onTheme}>
			<option value="system">System</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</label>
	<p class="muted" style="font-size:13px">Applies on this device only.</p>

	<p class="section-head">OneDrive</p>
	<p class="muted" style="font-size:13px">
		The OneDrive connection is for the whole app, not one ledger: you sign in once with a single
		Microsoft account and every ledger you create or join syncs through it. That's why it lives here
		rather than inside a ledger's settings — a ledger's own screen only shows that ledger's sync
		status and a “Sync now”.
	</p>
	{#if !app.oneDriveConfigured}
		<p class="muted" style="font-size:13px">
			Cloud sync is unavailable in this build. Ledgers stay on this device only — keep each ledger's
			recovery code safe so nothing can be lost.
		</p>
	{:else if !app.connected}
		<a class="btn btn-primary btn-block" href={resolve('/auth/start')}>☁ Connect OneDrive</a>
		<p class="muted" style="font-size:13px">
			Connect to sync your ledgers across devices and share them with others.
		</p>
	{:else}
		<p>☁ Connected. Ledgers sync automatically.</p>
		<button class="btn btn-block" onclick={() => app.signOut()}>Disconnect OneDrive</button>
		<p class="muted" style="font-size:13px">
			Disconnecting stops syncing on this device. Local data stays; reconnect any time.
		</p>
	{/if}

	<p class="section-head">Data</p>
	<a class="btn btn-block" href={resolve('/backup')}>Backup &amp; restore</a>
	<p class="muted" style="font-size:13px">
		Export the whole app to one file, or restore from one. The backup is unencrypted — read the
		warning on that screen.
	</p>
</div>
