<!--
  Reusable recovery/join-code panel (SC-ARC-ENC-4, SC-ARC-ENC-6): QR + the
  exact code string + copy/download. Used by the create flow's step 2 and by
  the settings "show recovery code" action.
-->
<script lang="ts">
	import QrCode from './QrCode.svelte';

	let { code, ledgerName }: { code: string; ledgerName: string } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	function download() {
		const body =
			`SplitClone recovery code for "${ledgerName}"\n\n${code}\n\n` +
			`Anyone with this code has full access to this ledger. Keep it secret.\n` +
			`SplitClone has no servers and cannot reset it for you.\n`;
		const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `splitclone-recovery-${ledgerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="recovery">
	<QrCode text={code} />

	<code class="codeblock">{code}</code>

	<div class="actions">
		<button type="button" onclick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
		<button type="button" onclick={download}>💾 Download .txt</button>
	</div>

	<p class="warn">
		⚠ Anyone with this code has full access to the ledger. Share it only over a channel you trust,
		and never paste it into a website.
	</p>
</div>

<style>
	.recovery {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.codeblock {
		display: block;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
		word-break: break-all;
		background: var(--surface-2, #f4f4f5);
		padding: 12px;
		border-radius: 8px;
		user-select: all;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.actions button {
		flex: 1;
	}
	.warn {
		font-size: 0.85rem;
		color: var(--danger, #b00020);
		margin: 0;
	}
</style>
