<script lang="ts">
	import { APP_VERSION, SCHEMA_VERSION } from '$lib/meta';
</script>

<svelte:head>
	<title>SplitClone</title>
</svelte:head>

<main>
	<h1>SplitClone</h1>
	<p class="tagline">
		Privacy-first shared-expense tracking, backed by an encrypted OneDrive folder. No server.
	</p>

	<section class="status">
		<h2>Phase 1 — scaffolding</h2>
		<p>
			Project skeleton is up. The domain, storage, sync, export, auth, platform and UI layers are
			stubbed and the import-boundary rule that keeps <code>domain/</code> pure is enforced. No features
			yet — that starts in Phase 2.
		</p>
		<dl>
			<dt>App version</dt>
			<dd>{APP_VERSION}</dd>
			<dt>Schema version</dt>
			<dd>{SCHEMA_VERSION}</dd>
		</dl>
	</section>
</main>

<style>
	main {
		max-width: 36rem;
		margin: 0 auto;
		padding: var(--space-8) var(--space-4);
	}

	h1 {
		font-size: 28px;
		margin: 0 0 var(--space-2);
	}

	.tagline {
		color: var(--text-muted);
		margin: 0 0 var(--space-8);
	}

	.status {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: var(--space-4) var(--space-6);
	}

	.status h2 {
		font-size: 17px;
		margin: 0 0 var(--space-2);
	}

	.status p {
		margin: 0 0 var(--space-4);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	dt {
		color: var(--text-muted);
	}

	dd {
		margin: 0;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.9em;
	}
</style>
