<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';
	import RecoveryCode from '$lib/ui/components/RecoveryCode.svelte';
	import ClaimParticipant from '$lib/ui/components/ClaimParticipant.svelte';

	let { children } = $props();

	const ledgerId = $derived(page.params.ledgerId!);
	const exists = $derived(app.hasLedger(ledgerId));
	const ledger = $derived(exists ? app.derived(ledgerId) : undefined);
	const needsClaim = $derived(exists && app.needsClaim(ledgerId));

	// SC-FR-SYN-3: one glyph + label per sync state.
	const sync = $derived(
		!app.oneDriveConfigured || !app.connected
			? { icon: '○', label: 'Local only — not synced' }
			: app.syncState === 'syncing'
				? { icon: '⟳', label: 'Syncing…' }
				: app.syncState === 'offline'
					? { icon: '⌧', label: 'Offline — changes will sync later' }
					: app.syncState === 'error'
						? { icon: '⚠', label: `Sync error: ${app.syncError}` }
						: { icon: '☁', label: 'In sync' }
	);

	const code = $derived(app.joinCodeFor(ledgerId));
	const needsRecoveryNag = $derived(exists && !app.recoveryAcknowledged(ledgerId) && !!code);
	let showRecovery = $state(false);

	function acknowledge() {
		app.acknowledgeRecovery(ledgerId);
		showRecovery = false;
	}

	// Base-path-safe links (SC-ARC-HST-2 / no-navigation-without-resolve).
	const link = $derived({
		home: resolve('/'),
		ledger: resolve('/ledger/[ledgerId]', { ledgerId }),
		settings: resolve('/ledger/[ledgerId]/settings', { ledgerId }),
		balances: resolve('/ledger/[ledgerId]/balances', { ledgerId }),
		labels: resolve('/ledger/[ledgerId]/labels', { ledgerId }),
		export: resolve('/ledger/[ledgerId]/export', { ledgerId })
	});
	// Tab state from the route id, which is independent of any base path.
	const routeId = $derived(page.route.id ?? '');
	function tabCurrent(seg: string): 'page' | undefined {
		if (seg === '') {
			return routeId === '/ledger/[ledgerId]' || routeId.startsWith('/ledger/[ledgerId]/expense')
				? 'page'
				: undefined;
		}
		return routeId === `/ledger/[ledgerId]/${seg}` ? 'page' : undefined;
	}
</script>

{#if !exists}
	<div class="topbar">
		<a href={link.home}>‹ Home</a><span class="title">Ledger not found</span>
	</div>
	<div class="screen empty">
		<p>This ledger isn’t on this device.</p>
		<a class="btn" href={link.home}>Back to ledgers</a>
	</div>
{:else}
	<div class="topbar">
		<a href={link.home} aria-label="Back to ledgers">‹</a>
		<span class="title">{ledger?.ledgerName}</span>
		<a href={link.settings} title={sync.label} aria-label={sync.label}>{sync.icon}</a>
		<a href={link.settings} aria-label="Settings">⋮</a>
	</div>

	{#if needsClaim}
		<ClaimParticipant {ledgerId} ledgerName={ledger?.ledgerName ?? 'this ledger'} />
	{:else}
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
			<a href={link.ledger} aria-current={tabCurrent('')}>Expenses</a>
			<a href={link.balances} aria-current={tabCurrent('balances')}>Balances</a>
			<a href={link.labels} aria-current={tabCurrent('labels')}>Labels</a>
			<a href={link.export} aria-current={tabCurrent('export')}>Export</a>
		</nav>
	{/if}
{/if}

<style>
	.recovery-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: var(--space-3) var(--space-4) 0;
		padding: 10px 16px;
		background: color-mix(in srgb, var(--warning) 18%, transparent);
		color: var(--warning);
		font-size: 0.85rem;
		border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
		border-radius: var(--radius-sm);
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
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		display: grid;
		place-items: center;
		padding: 20px;
		z-index: 50;
	}
	.sheet {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: var(--space-6);
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
