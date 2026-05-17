<script lang="ts">
	import { page } from '$app/state';
	import { app } from '$lib/ui/stores/app.svelte';
	import { project, type ExportMode } from '$lib/domain';
	import { toCsv, LEDGER_CURRENCY } from '$lib/export/csv';
	import { applyExportFilter } from '$lib/export/filter';
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

	// SC-FR-EXR-5: honour the date-range + label filter active in the list.
	const filter = $derived(app.filter(ledgerId));
	const filterLabelNames = $derived(
		filter.labels.map((id) => ledger.labels.get(id)?.name).filter((n): n is string => !!n)
	);
	const rows = $derived(
		subject
			? applyExportFilter(project(ledger, subject, mode), {
					from: filter.from,
					to: filter.to,
					labels: filterLabelNames
				})
			: []
	);
	const total = $derived(rows.reduce((s, r) => s + r.amount, 0n));
	const filterActive = $derived(app.filterActive(ledgerId));

	function slug(s: string): string {
		return s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function fileName(): string {
		const d = new Date();
		const p = (n: number) => String(n).padStart(2, '0');
		const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
		const sName = ledger.participants.get(subject)?.name ?? subject;
		return `splitclone_${slug(ledger.ledgerName)}_${slug(sName)}_${mode}_${ts}.csv`;
	}

	function csvFile(): File {
		return new File([toCsv(rows, LEDGER_CURRENCY)], fileName(), {
			type: 'text/csv;charset=utf-8'
		});
	}

	function download() {
		const file = csvFile();
		const a = document.createElement('a');
		a.href = URL.createObjectURL(file);
		a.download = file.name;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	// SC-FR-EXR-6: where the Web Share API supports files (notably iOS Safari)
	// additionally offer the OS share sheet.
	let canShare = $state(false);
	$effect(() => {
		try {
			canShare =
				typeof navigator !== 'undefined' &&
				!!navigator.canShare &&
				navigator.canShare({ files: [new File(['x'], 'x.csv', { type: 'text/csv' })] });
		} catch {
			canShare = false;
		}
	});

	async function share() {
		try {
			await navigator.share({ files: [csvFile()], title: 'SplitClone export' });
		} catch {
			/* user cancelled / share unavailable → the download button stays */
		}
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

	{#if filterActive}
		<p class="muted" style="font-size:13px">
			ⓘ The list filter is applied to this export
			{#if filter.from || filter.to}· {filter.from || '…'} → {filter.to || '…'}{/if}
			{#if filterLabelNames.length}· labels: {filterLabelNames.join(', ')}{/if}
		</p>
	{/if}

	<p class="section-head">Preview</p>
	{#if rows.length === 0}
		<p class="muted">No rows for this selection.</p>
	{:else}
		<p class="muted">{rows.length} rows · net {euro(total)}</p>
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
		onclick={download}
		disabled={rows.length === 0}>Download CSV</button
	>
	{#if canShare}
		<button
			class="btn btn-block"
			style="margin-top:var(--space-2)"
			onclick={share}
			disabled={rows.length === 0}>Share via…</button
		>
	{/if}
	<p class="muted" style="font-size:13px">RFC 4180 CSV, UTF-8 · {LEDGER_CURRENCY}</p>
</div>
