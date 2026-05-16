<script lang="ts">
	import { page } from '$app/state';
	import ExpenseForm from '$lib/ui/components/ExpenseForm.svelte';
</script>

<svelte:head><title>New expense</title></svelte:head>

<ExpenseForm ledgerId={page.params.ledgerId!} />
