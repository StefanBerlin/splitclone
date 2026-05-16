<!--
  QR rendering for the join code (SC-ARC-ENC-4a). qr-creator is pure-JS (no
  canvas dependency) and only pulled in on the screens that show a code.
  The QR encodes the exact same string as the paste form, so the two are
  interchangeable.
-->
<script lang="ts">
	import QrCreator from 'qr-creator';

	let { text, size = 200 }: { text: string; size?: number } = $props();
	let host: HTMLDivElement;

	// qr-creator is an imperative renderer with no Svelte-managed children in
	// `host`; Svelte never touches its subtree, so direct manipulation here is
	// safe. (The rule can't see that the node stays leaf-only to Svelte.)
	/* eslint-disable svelte/no-dom-manipulating */
	$effect(() => {
		const value = text;
		if (!host) return;
		host.replaceChildren();
		QrCreator.render(
			{ text: value, radius: 0, ecLevel: 'M', fill: '#111', background: '#fff', size },
			host
		);
	});
	/* eslint-enable svelte/no-dom-manipulating */
</script>

<div
	class="qr"
	bind:this={host}
	style="width:{size}px;height:{size}px"
	aria-label="Join code QR"
></div>

<style>
	.qr {
		display: grid;
		place-items: center;
		background: #fff;
		padding: 12px;
		border-radius: 8px;
		margin: 0 auto;
	}
</style>
