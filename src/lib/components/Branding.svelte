<script lang="ts">
	let { isMobile } = $props<{ isMobile: boolean }>();
</script>

<div
	class="text-1xl pointer-events-none absolute top-0 right-0 z-10 rounded-bl-lg bg-base-200 px-3 py-2"
>
	<span style="color:#00ff00">Militär</span>News
</div>

{#if !isMobile}
	<div
		class="text-1xl pointer-events-none absolute bottom-0 left-0 z-10 rounded-tr-lg bg-base-200 px-3 py-2"
	>
		<span style="color:#00ff00">Militär</span>News
	</div>
{/if}
