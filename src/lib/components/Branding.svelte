<script lang="ts">
	let { isMobile } = $props<{ isMobile: boolean }>();
</script>

<div class="pointer-events-none absolute top-0 right-0 z-10 px-3 py-2 text-xl">
	<span style="color:#00ff00">Militär</span>News
</div>

{#if !isMobile}
	<div class="pointer-events-none absolute bottom-0 left-0 z-10 px-3 py-2 text-xl">
		<span style="color:#00ff00">Militär</span>News
	</div>
{/if}
