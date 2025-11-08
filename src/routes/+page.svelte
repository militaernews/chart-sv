<!-- +page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas-pro';
	import Branding from '$lib/components/Branding.svelte';

	let title = $state('Russian Losses in Kharkiv — June 3, 2024');
	let maxScaleValue = $state(0); // 0 means auto
	let tableData = $state(`Category,Destroyed,Damaged
Panzer,9,0
Schützenpanzer,13,0
Gepanzerte Fahrzeuge,1,0
Mehrfachraktenwerfer,0,0
Selbstfahrlafetten,0,0
Gezogene Artillerie,0,0
Luftverteidigungssysteme,2,0
Führungsfahrzeuge,0,0
Pionierfahrzeuge,10,1
Radare und Jammer,1,0
Lastkraftwagen,6,1
Helikopter,0,0
UAVs,0,0`);

	let chartElement = $state(null);
	let isExporting = $state(false);

	// Parse CSV data
	const chartData = $derived.by(() => {
		const lines = tableData.trim().split('\n');
		const headers = lines[0].split(',').map((h) => h.trim());

		return lines
			.slice(1)
			.map((line) => {
				const values = line.split(',');
				const obj = {};
				headers.forEach((header, i) => {
					obj[header] = isNaN(values[i]) ? values[i]?.trim() : parseInt(values[i]);
				});
				return obj;
			})
			.filter((item) => (item.Destroyed || 0) > 0 || (item.Damaged || 0) > 0);
	});

	const maxValue = $derived(
		Math.max(...chartData.flatMap((d) => [d.Destroyed || 0, d.Damaged || 0]))
	);

	const effectiveMaxValue = $derived(maxScaleValue > 0 ? maxScaleValue : maxValue);

	// Load from localStorage on mount
	onMount(() => {
		const saved = localStorage.getItem('militaryChartData');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				title = data.title || title;
				tableData = data.tableData || tableData;
				maxScaleValue = data.maxScaleValue || 0;
			} catch (e) {
				console.error('Failed to load saved data', e);
			}
		}
	});

	// Save to localStorage whenever data changes
	$effect(() => {
		const data = { title, tableData, maxScaleValue };
		localStorage.setItem('militaryChartData', JSON.stringify(data));
	});

	function loadExample1() {
		title = 'Russian Losses in Kharkiv — June 3, 2024';
		tableData = `Category,Destroyed,Damaged
Panzer,9,0
Schützenpanzer,13,0
Gepanzerte Fahrzeuge,1,0
Mehrfachraktenwerfer,0,0
Selbstfahrlafetten,0,0
Gezogene Artillerie,0,0
Luftverteidigungssysteme,2,0
Führungsfahrzeuge,0,0
Pionierfahrzeuge,10,1
Radare und Jammer,1,0
Lastkraftwagen,6,1
Helikopter,0,0
UAVs,0,0`;
	}

	function loadExample2() {
		title = 'Russian 2024 Kharkiv Oblast Offensive Losses as of 2024-08-26';
		tableData = `Category,Total,Destroyed,Abandoned,Captured,Damaged
Tanks,24,22,0,2,0
Armoured Fighting Vehicles,59,58,0,0,1
Infantry Mobility Vehicles,4,4,0,0,0
MLRS,1,1,0,0,0
Self-propelled Artillery,3,1,0,0,2
Towed Artillery,0,0,0,0,0
Anti-aircraft Systems,3,3,0,0,0
Command Vehicles,0,0,0,0,0
Engineering,26,22,1,0,3
Radars and Jammers,2,1,0,0,1
Trucks,37,36,0,0,1
Aircraft,0,0,0,0,0
Helicopters,0,0,0,0,0
Drones,3,3,0,0,0`;
	}

	async function exportAsImage() {
		if (!chartElement) return;

		isExporting = true;

		try {
			// Wait a bit for any transitions to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			const canvas = await html2canvas(chartElement, {
				backgroundColor: '#1a1a1a',
				scale: 2,
				logging: false,
				useCORS: true,
				allowTaint: true,
				windowWidth: chartElement.scrollWidth,
				windowHeight: chartElement.scrollHeight,
				onclone: (clonedDoc) => {
					// Replace oklch colors with standard hex colors
					const clonedElement = clonedDoc.querySelector('[data-export-chart]');
					if (clonedElement) {
						clonedElement.querySelectorAll('*').forEach((el) => {
							const htmlEl = el as HTMLElement;
							const computedStyle = window.getComputedStyle(htmlEl);

							// Get and set background color
							if (
								computedStyle.backgroundColor &&
								computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
							) {
								htmlEl.style.backgroundColor = computedStyle.backgroundColor;
							}

							// Get and set text color
							if (computedStyle.color) {
								htmlEl.style.color = computedStyle.color;
							}

							// Get and set border color
							if (computedStyle.borderColor) {
								htmlEl.style.borderColor = computedStyle.borderColor;
							}
						});
					}
				}
			});

			// Convert canvas to blob for better browser compatibility
			canvas.toBlob((blob) => {
				if (!blob) {
					throw new Error('Failed to create image blob');
				}

				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
				link.href = url;
				link.click();

				// Clean up the URL after a short delay
				setTimeout(() => URL.revokeObjectURL(url), 100);
			}, 'image/png');
		} catch (error) {
			console.error('Export failed:', error);
			alert('Export failed. Please try again.');
		} finally {
			isExporting = false;
		}
	}

	function getBarWidth(value, type) {
		const percentage = (value / effectiveMaxValue) * 100;
		return `${Math.min(percentage, 100)}%`;
	}
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
	<!-- Input Section -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body p-4">
			<h2 class="card-title text-lg">Configuration</h2>

			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Chart Title</span>
				</label>
				<input type="text" bind:value={title} class="input-bordered input input-sm" />
			</div>

			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Max Scale Value (0 = auto)</span>
				</label>
				<input
					type="number"
					bind:value={maxScaleValue}
					class="input-bordered input input-sm"
					min="0"
				/>
			</div>

			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Table Data (CSV format)</span>
				</label>
				<textarea
					class="textarea-bordered textarea h-48 font-mono text-xs"
					bind:value={tableData}
					placeholder="Category,Destroyed,Damaged"
				></textarea>
			</div>

			<div class="mt-2 flex flex-wrap gap-1">
				<button class="btn btn-outline btn-xs" onclick={loadExample1}> Example 1 </button>
				<button class="btn btn-outline btn-xs" onclick={loadExample2}> Example 2 </button>
			</div>

			<button class="btn btn-sm btn-primary" onclick={exportAsImage} disabled={isExporting}>
				{isExporting ? 'Exporting...' : '📸 Export'}
			</button>
		</div>
	</div>

	<!-- Chart Section -->
	<div class="card bg-neutral text-neutral-content shadow-xl lg:col-span-2">
		<div class="card-body">
			<div bind:this={chartElement} data-export-chart class="relative rounded-lg bg-neutral p-4">
				<!-- Branding Component -->
				<Branding isMobile={false} />

				<h3 class="text-md mb-6 text-center font-semibold md:text-base">{title}</h3>

				<!-- Horizontal Bar Chart with Grid -->
				<div class="relative">
					<!-- Bars -->
					<div class="relative space-y-2 pt-4 pb-6">
						{#each chartData as item}
							<div class="flex items-center gap-2 text-xs md:text-sm">
								<div class="w-32 truncate text-right md:w-40" title={item.Category}>
									{item.Category}
								</div>
								<div class="relative flex flex-1 items-center gap-1">
									<!-- Grid lines for this row -->
									<div class="absolute inset-0 flex">
										{#each Array(5) as _, i}
											<div class="flex flex-1">
												<div class="h-full w-px bg-gray-700"></div>
											</div>
										{/each}
										<div class="h-full w-px bg-gray-700"></div>
									</div>

									<!-- Bar content -->
									<div class="relative z-10 flex flex-1 items-center gap-1">
										{#if item.Destroyed > 0}
											<div
												class="relative flex h-6 items-center justify-center bg-error font-semibold text-white transition-all md:h-8"
												style="width: {getBarWidth(item.Destroyed, 'destroyed')}"
											>
												<span class="px-2">{item.Destroyed}</span>
											</div>
										{/if}
										{#if item.Damaged > 0}
											<div
												class="relative flex h-6 items-center justify-center bg-warning font-semibold text-black transition-all md:h-8"
												style="width: {getBarWidth(item.Damaged, 'damaged')}"
											>
												<span class="px-2">{item.Damaged}</span>
											</div>
										{/if}
										<span class="relative z-10 ml-1 text-gray-400"
											>{(item.Destroyed || 0) + (item.Damaged || 0)}</span
										>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Scale labels at bottom -->
					<div class="flex items-center gap-2 text-xs md:text-sm">
						<div class="w-32 md:w-40"></div>
						<div class="flex flex-1">
							{#each Array(5) as _, i}
								<div class="flex flex-1">
									<span class="text-xs text-success">{Math.round((effectiveMaxValue * i) / 5)}</span
									>
								</div>
							{/each}
							<span class="text-xs text-success">{effectiveMaxValue}</span>
						</div>
					</div>
				</div>

				<!-- Legend -->
				<div class="mt-8 flex justify-center gap-6 text-xs md:text-sm">
					<div class="flex items-center gap-2">
						<div class="size-4 rounded bg-error"></div>
						<span>Zerstört (Destroyed)</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="size-4 rounded bg-warning"></div>
						<span>Beschädigt (Damaged)</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
