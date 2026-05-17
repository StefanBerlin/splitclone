<script lang="ts">
	import { page } from '$app/state';
	import SettleForm from '$lib/ui/components/SettleForm.svelte';
</script>

<SettleForm ledgerId={page.params.ledgerId!} />
