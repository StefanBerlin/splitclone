<script lang="ts">
	import { resolve } from '$app/paths';
	import { app } from '$lib/ui/stores/app.svelte';

	// ---- Export -----------------------------------------------------------
	let exportAck = $state(false);

	function downloadBackup() {
		const { filename, text, omitted } = app.exportBackup();
		const blob = new Blob([text], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = filename;
		a.click();
		URL.revokeObjectURL(a.href);
		if (omitted.length > 0) {
			alert(
				`Note: ${omitted.length} ledger(s) had no key on this device and were left out — they cannot be restored from a backup.`
			);
		}
	}

	// ---- Restore ----------------------------------------------------------
	type PreviewLedger = {
		ledgerId: string;
		eventCount: number;
		existsLocally: boolean;
		keyConflict: boolean;
	};

	let fileText = $state('');
	let fileName = $state('');
	let preview = $state<
		{ ok: true; exportedAt: string; ledgers: PreviewLedger[] } | { ok: false; error: string } | null
	>(null);
	let selected = $state<Record<string, boolean>>({});
	let mode = $state<'merge' | 'replace'>('merge');
	let busy = $state(false);
	let result = $state<{
		imported: string[];
		skipped: { ledgerId: string; reason: string }[];
	} | null>(null);

	async function onFile(e: Event) {
		result = null;
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (!f) return;
		fileName = f.name;
		fileText = await f.text();
		preview = await app.previewBackup(fileText);
		selected = {};
		if (preview.ok) {
			for (const l of preview.ledgers) selected[l.ledgerId] = !l.keyConflict;
		}
	}

	const chosenIds = $derived(Object.keys(selected).filter((id) => selected[id]));

	async function restore() {
		if (!preview?.ok || chosenIds.length === 0 || busy) return;
		if (
			mode === 'replace' &&
			!confirm(
				'Replace mode wipes ALL ledgers currently on this device and replaces them with the selected ones from the backup. This cannot be undone. Continue?'
			)
		) {
			return;
		}
		busy = true;
		try {
			result = await app.importBackup(fileText, mode, chosenIds);
		} catch (err) {
			result = {
				imported: [],
				skipped: [{ ledgerId: '—', reason: err instanceof Error ? err.message : String(err) }]
			};
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Backup &amp; restore</title></svelte:head>

<div class="topbar">
	<a href={resolve('/')}>‹ Back</a>
	<span class="title">Backup &amp; restore</span>
</div>

<div class="screen">
	<p class="section-head">Export</p>
	<div class="card danger">
		⚠ The backup file is <strong>not encrypted</strong>. It contains the recovery code of every
		ledger in clear text — anyone who gets the file can read all of them. Keep it somewhere you
		trust. SplitClone never uploads it; storing it safely is your responsibility.
	</div>
	<label class="ack">
		<input type="checkbox" bind:checked={exportAck} />
		<span>I understand the backup is unencrypted and I am responsible for keeping it safe.</span>
	</label>
	<button class="btn btn-primary btn-block" disabled={!exportAck} onclick={downloadBackup}>
		Download full backup
	</button>
	<p class="muted" style="font-size:13px">
		One JSON file with every ledger's full history, keys and recovery flags — everything needed to
		rebuild SplitClone on another device.
	</p>

	<p class="section-head">Restore</p>
	<input type="file" accept="application/json,.json" onchange={onFile} />

	{#if preview && !preview.ok}
		<div class="card danger" style="margin-top:var(--space-3)">✗ {preview.error}</div>
	{:else if preview && preview.ok}
		<p class="muted" style="font-size:13px">
			{fileName} · exported {preview.exportedAt || 'unknown'}
		</p>

		{#each preview.ledgers as l (l.ledgerId)}
			<label class="row" style="gap:12px">
				<input
					type="checkbox"
					checked={selected[l.ledgerId] ?? false}
					disabled={l.keyConflict}
					onchange={(e) => (selected[l.ledgerId] = e.currentTarget.checked)}
				/>
				<span class="grow">
					<span style="font-size:13px">{l.ledgerId}</span><br />
					<span class="muted" style="font-size:13px">
						{l.eventCount} events{#if l.keyConflict}
							· ⚠ key conflict — a different ledger here already uses this id; skipped{:else if l.existsLocally}
							· already on this device (merge is idempotent){/if}
					</span>
				</span>
			</label>
		{/each}

		<div class="chip-row" style="margin-top:var(--space-3)">
			<button class="chip" aria-pressed={mode === 'merge'} onclick={() => (mode = 'merge')}>
				Merge
			</button>
			<button class="chip" aria-pressed={mode === 'replace'} onclick={() => (mode = 'replace')}>
				Replace
			</button>
		</div>
		<p class="muted" style="font-size:13px">
			{#if mode === 'merge'}
				Adds the selected ledgers into what's already here. Re-importing the same file changes
				nothing (idempotent). Existing ledgers are untouched; a same-id/different-key ledger is
				skipped, never overwritten.
			{:else}
				Wipes everything on this device first, then restores the selected ledgers. Use this for a
				clean move to a new device. This device keeps its own identity; you re-pick your participant
				per ledger afterwards.
			{/if}
		</p>

		<button
			class="btn btn-primary btn-block"
			disabled={chosenIds.length === 0 || busy}
			onclick={restore}
		>
			{busy ? 'Restoring…' : `Restore ${chosenIds.length} ledger(s)`}
		</button>
	{/if}

	{#if result}
		<div class="card" style="margin-top:var(--space-3)">
			<p>✓ Restored {result.imported.length} ledger(s).</p>
			{#if result.skipped.length > 0}
				<p class="muted" style="font-size:13px;margin-top:6px">
					Skipped:
					{#each result.skipped as s (s.ledgerId + s.reason)}
						<br />· {s.ledgerId}: {s.reason}
					{/each}
				</p>
			{/if}
			<a class="btn btn-block" style="margin-top:var(--space-3)" href={resolve('/')}>
				Back to ledgers
			</a>
		</div>
	{/if}
</div>

<style>
	.card.danger {
		border-color: var(--danger);
		color: var(--danger);
	}
	.ack {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		font-size: 0.9rem;
		padding: 4px 0;
	}
	.ack input {
		margin-top: 3px;
	}
</style>
