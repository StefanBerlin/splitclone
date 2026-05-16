<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import { project, formatMoney, type ExportMode } from '$lib/domain';
	import { euro } from '$lib/ui/format/format';

	const ledgerId = $derived(page.params.ledgerId!);
	const ledger = $derived(app.derived(ledgerId));
	const meId = $derived(app.claimedParticipantId(ledgerId));

	let subject = $state('');
	let mode = $state<ExportMode>('cash');

	$effect(() => {
		if (!subject && (meId || ledger.participants.size)) {
			subject = meId ?? [...ledger.participants.keys()][0] ?? '';
		}
	});

	const rows = $derived(subject ? project(ledger, subject, mode) : []);
	const total = $derived(rows.reduce((s, r) => s + r.amount, 0n));

	function field(v: string): string {
		return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
	}
	function slug(s: string): string {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function exportCsv() {
		const header = 'Date,Description,Amount,Currency,Counterparty,Labels,Note,SourceId';
		const lines = rows.map((r) =>
			[
				r.date,
				field(r.description),
				formatMoney(r.amount),
				'EUR',
				field(r.counterparties.join(', ')),
				field(r.labels.join('; ')),
				field(r.note ?? ''),
				r.sourceId
			].join(',')
		);
		const csv = [header, ...lines].join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const ts = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 15);
		const sName = ledger.participants.get(subject)?.name ?? subject;
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `splitclone_${slug(ledger.ledgerName)}_${slug(sName)}_${mode}_${ts}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	}
</script>

<svelte:head><title>Export</title></svelte:head>

<div class="screen">
	<label class="field">
		<span>Export expenses for…</span>
		<select bind:value={subject}>
			{#each [...ledger.participants.values()] as p (p.id)}
				<option value={p.id}>{p.id === meId ? `${p.name} (you)` : p.name}</option>
			{/each}
		</select>
	</label>

	<div class="field">
		<span class="muted" style="font-size:13px">Mode</span>
		<label style="display:block; margin:var(--space-2) 0"
			><input type="radio" value="cash" bind:group={mode} style="width:auto" /> Cash basis — money that
			actually moved in/out of your account.</label
		>
		<label style="display:block"
			><input type="radio" value="virtual" bind:group={mode} style="width:auto" /> Virtual account — each
			joint expense moves the balance by your share.</label
		>
	</div>

	<p class="section-head">Preview</p>
	{#if rows.length === 0}
		<p class="muted">No rows for this selection.</p>
	{:else}
		<p class="muted">
			{rows.length} rows · net {euro(total)}
		</p>
		<div class="dl">
			{#each rows.slice(0, 8) as r (r.sourceId)}
				<dt>{r.date} {r.description}</dt>
				<dd class:pos={r.amount > 0n} class:neg={r.amount < 0n}>{euro(r.amount)}</dd>
			{/each}
		</div>
		{#if rows.length > 8}<p class="muted" style="font-size:13px">
				…and {rows.length - 8} more
			</p>{/if}
	{/if}

	<button
		class="btn btn-primary btn-block"
		style="margin-top:var(--space-6)"
		onclick={exportCsv}
		disabled={rows.length === 0}>Export CSV</button
	>
	<p class="muted" style="font-size:13px">
		Phase 3 uses a basic CSV writer; the RFC-4180 formatter and Web-Share delivery land in Phase 9.
	</p>
</div>
