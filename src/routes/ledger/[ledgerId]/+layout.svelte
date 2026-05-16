<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import RecoveryCode from '$lib/ui/components/RecoveryCode.svelte';

	let { children } = $props();

	const ledgerId = $derived(page.params.ledgerId!);
	const exists = $derived(app.hasLedger(ledgerId));
	const ledger = $derived(exists ? app.derived(ledgerId) : undefined);
	const path = $derived(page.url.pathname);

	const code = $derived(app.joinCodeFor(ledgerId));
	const needsRecoveryNag = $derived(exists && !app.recoveryAcknowledged(ledgerId) && !!code);
	let showRecovery = $state(false);

	function acknowledge() {
		app.acknowledgeRecovery(ledgerId);
		showRecovery = false;
	}

	const base = $derived(`/ledger/${ledgerId}`);
	function tabCurrent(seg: string): 'page' | undefined {
		if (seg === '') {
			return path === base || path.startsWith(`${base}/expense`) ? 'page' : undefined;
		}
		return path.startsWith(`${base}/${seg}`) ? 'page' : undefined;
	}
</script>

{#if !exists}
	<div class="topbar"><a href="/">‹ Home</a><span class="title">Ledger not found</span></div>
	<div class="screen empty">
		<p>This ledger isn’t on this device.</p>
		<a class="btn" href="/">Back to ledgers</a>
	</div>
{:else}
	<div class="topbar">
		<a href="/" aria-label="Back to ledgers">‹</a>
		<span class="title">{ledger?.ledgerName}</span>
		<a href="{base}/settings" title="Sync: in sync">☁</a>
		<a href="{base}/settings" aria-label="Settings">⋮</a>
	</div>

	{#if needsRecoveryNag}
		<div class="recovery-banner">
			<span>⚠ Save your recovery code for “{ledger?.ledgerName}”</span>
			<button class="link" onclick={() => (showRecovery = true)}>Show code</button>
		</div>
	{/if}

	{#if showRecovery && code}
		<div
			class="overlay"
			role="button"
			tabindex="0"
			onclick={() => (showRecovery = false)}
			onkeydown={(e) => e.key === 'Escape' && (showRecovery = false)}
		>
			<div
				class="sheet"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
				onkeydown={() => {}}
			>
				<h2>Recovery code</h2>
				<RecoveryCode {code} ledgerName={ledger?.ledgerName ?? 'ledger'} />
				<div class="sheet-actions">
					<button class="btn" onclick={() => (showRecovery = false)}>Close</button>
					{#if !app.recoveryAcknowledged(ledgerId)}
						<button class="btn btn-primary" onclick={acknowledge}>I’ve saved it</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{@render children()}

	<nav class="tabbar">
		<a href={base} aria-current={tabCurrent('')}>Expenses</a>
		<a href="{base}/balances" aria-current={tabCurrent('balances')}>Balances</a>
		<a href="{base}/labels" aria-current={tabCurrent('labels')}>Labels</a>
		<a href="{base}/export" aria-current={tabCurrent('export')}>Export</a>
	</nav>
{/if}

<style>
	.recovery-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 16px;
		background: #fff4e5;
		color: #8a4b00;
		font-size: 0.85rem;
		border-bottom: 1px solid #f0d9b5;
	}
	.recovery-banner .link {
		background: none;
		border: none;
		color: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
		flex: none;
	}
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: grid;
		place-items: center;
		padding: 20px;
		z-index: 50;
	}
	.sheet {
		background: var(--surface, #fff);
		border-radius: 12px;
		padding: 20px;
		max-width: 360px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
	}
	.sheet h2 {
		margin: 0 0 12px;
		font-size: 1.1rem;
	}
	.sheet-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.sheet-actions .btn {
		flex: 1;
	}
</style>
