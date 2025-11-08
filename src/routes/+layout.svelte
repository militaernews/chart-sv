<script lang="ts">
	import CookieBanner from '$lib/components/CookieBanner.svelte';
	import '../app.css';
	let { children } = $props();
</script>

<div
	class="flex min-h-dvh w-dvw items-center justify-center bg-black p-4"
	style="font-family:'HP Simplified'"
>
	<div class="flex w-full flex-col">
		{@render children()}
	</div>
</div>

<CookieBanner />
