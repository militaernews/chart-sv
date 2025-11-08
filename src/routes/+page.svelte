<!-- +page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas-pro';
	import Branding from '$lib/components/Branding.svelte';

	let title = $state('Russian Losses in Kharkiv');
	let subtitle = $state('as of June 3, 2024');
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

	// Default colors for legend items
	let legendColors = $state({
		Destroyed: '#ff0000',
		Damaged: '#ffaa00'
	});

	let chartElement = $state(null);
	let isExporting = $state(false);
	let isLoaded = $state(false);

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
			.filter((item) => {
				// Filter out Category column and check if any value > 0
				return Object.keys(item).some((key) => key !== 'Category' && (item[key] || 0) > 0);
			});
	});

	// Get legend items (all columns except Category and Total)
	const legendItems = $derived.by(() => {
		if (!tableData) return [];
		const headers = tableData
			.trim()
			.split('\n')[0]
			.split(',')
			.map((h) => h.trim());
		return headers.filter((h) => h !== 'Category' && h !== 'Total');
	});

	// Sync legendColors with current legend items
	$effect(() => {
		const newColors = { ...legendColors };
		legendItems.forEach((item, index) => {
			if (!newColors[item]) {
				// Assign default colors
				const defaultColors = ['#ff0000', '#ffaa00', '#ffdd00', '#666666'];
				newColors[item] = defaultColors[index % defaultColors.length];
			}
		});
		legendColors = newColors;
	});

	const maxValue = $derived(
		Math.max(...chartData.flatMap((d) => legendItems.map((key) => d[key] || 0)))
	);

	const effectiveMaxValue = $derived(maxScaleValue > 0 ? maxScaleValue : maxValue);

	// Load from storage on mount
	onMount(async () => {
		const result = await window.storage.get('chartData').catch(() => null);
		if (result?.value) {
			const data = JSON.parse(result.value);
			if (data.title !== undefined) title = data.title;
			if (data.subtitle !== undefined) subtitle = data.subtitle;
			if (data.maxScaleValue !== undefined) maxScaleValue = data.maxScaleValue;
			if (data.tableData !== undefined) tableData = data.tableData;
			if (data.legendColors !== undefined) legendColors = data.legendColors;
		}
		isLoaded = true;
	});

	// Save all data to storage whenever any value changes
	$effect(() => {
		if (!isLoaded) return;
		const data = {
			title,
			subtitle,
			maxScaleValue,
			tableData,
			legendColors
		};
		window.storage.set('chartData', JSON.stringify(data)).catch(console.error);
	});

	// Save all data to storage whenever any value changes
	$effect(() => {
		const data = {
			title,
			subtitle,
			maxScaleValue,
			tableData,
			legendColors
		};
		window.storage.set('chartData', JSON.stringify(data)).catch(console.error);
	});

	function loadExample1() {
		title = 'Russian Losses in Kharkiv';
		subtitle = 'June 3, 2024';
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
		title = 'Russian 2024 Kharkiv Oblast Offensive Losses';
		subtitle = 'as of 2024-08-26';
		tableData = `Category,Destroyed,Abandoned,Captured,Damaged
Tanks,22,0,2,0
Armoured Fighting Vehicles,58,0,0,1
Infantry Mobility Vehicles,4,0,0,0
MLRS,1,0,0,0
Self-propelled Artillery,1,0,0,2
Towed Artillery,0,0,0,0
Anti-aircraft Systems,3,0,0,0
Command Vehicles,0,0,0,0
Engineering,22,1,0,3
Radars and Jammers,1,0,0,1
Trucks,36,0,0,1
Aircraft,0,0,0,0
Helicopters,0,0,0,0
Drones,3,0,0,0`;
	}

	async function exportAsImage() {
		if (!chartElement) return;

		isExporting = true;

		try {
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
					const clonedElement = clonedDoc.querySelector('[data-export-chart]');
					if (clonedElement) {
						clonedElement.querySelectorAll('*').forEach((el) => {
							const htmlEl = el as HTMLElement;
							const computedStyle = window.getComputedStyle(htmlEl);

							if (
								computedStyle.backgroundColor &&
								computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
							) {
								htmlEl.style.backgroundColor = computedStyle.backgroundColor;
							}

							if (computedStyle.color) {
								htmlEl.style.color = computedStyle.color;
							}

							if (computedStyle.borderColor) {
								htmlEl.style.borderColor = computedStyle.borderColor;
							}
						});
					}
				}
			});

			canvas.toBlob((blob) => {
				if (!blob) {
					throw new Error('Failed to create image blob');
				}

				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
				link.href = url;
				link.click();

				setTimeout(() => URL.revokeObjectURL(url), 100);
			}, 'image/png');
		} catch (error) {
			console.error('Export failed:', error);
			alert('Export failed. Please try again.');
		} finally {
			isExporting = false;
		}
	}

	function getBarWidth(value, maxVal) {
		const percentage = (value / maxVal) * 100;
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
					<span class="label-text text-xs">Subtitle/Date</span>
				</label>
				<input type="text" bind:value={subtitle} class="input-bordered input input-sm" />
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

			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Legend Colors</span>
				</label>
				<div class="space-y-2">
					{#each legendItems as item}
						<div class="flex items-center gap-2">
							<input
								type="color"
								bind:value={legendColors[item]}
								class="h-8 w-12 cursor-pointer rounded border"
							/>
							<span class="text-xs">{item}</span>
						</div>
					{/each}
				</div>
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

				<!-- Title with optional divider and subtitle -->
				<div class="mb-6 text-center">
					<h3 class="text-md font-semibold md:text-base">{title}</h3>
					{#if subtitle && subtitle.trim()}
						<div class="mx-auto my-2 h-px w-48 bg-gray-600"></div>
						<p class="text-xs text-gray-400 md:text-sm">{subtitle}</p>
					{/if}
				</div>

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
										{#each Array(4) as _, i}
											<div class="flex flex-1">
												<div class="h-full w-px bg-gray-600"></div>
											</div>
										{/each}
										<div class="h-full w-px bg-gray-600"></div>
									</div>

									<!-- Bar content -->
									<div class="relative z-10 flex flex-1 items-center gap-1">
										{#each legendItems as legendItem}
											{#if item[legendItem] > 0}
												<div
													class="relative flex h-6 items-center justify-center font-semibold text-white transition-all md:h-8"
													style="width: {getBarWidth(
														item[legendItem],
														effectiveMaxValue
													)}; background-color: {legendColors[legendItem]}"
												>
													<span class="px-2">{item[legendItem]}</span>
												</div>
											{/if}
										{/each}
										<span class="relative z-10 ml-1 text-gray-400">
											{legendItems.reduce((sum, key) => sum + (item[key] || 0), 0)}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Scale labels at bottom -->
					<div class="flex items-center gap-2 text-xs md:text-sm">
						<div class="w-32 md:w-40"></div>
						<div class="flex flex-1">
							{#each Array(4) as _, i}
								<div class="flex flex-1">
									<span class=" text-xs" style="color:#00ff00"
										>{Math.round((effectiveMaxValue * i) / 4)}</span
									>
								</div>
							{/each}
							<span class="text-xs" style="color:#00ff00">{effectiveMaxValue}</span>
						</div>
					</div>
				</div>

				<!-- Dynamic Legend -->
				<div class="mt-8 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
					{#each legendItems as item}
						<div class="flex items-center gap-2">
							<div class="size-4 rounded" style="background-color: {legendColors[item]}" />
							<span>{item}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
