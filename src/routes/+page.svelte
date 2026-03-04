<!-- +page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas-pro';
	import Branding from '$lib/components/Branding.svelte';
	import { Plot, BarX, RuleX, AxisX, AxisY, Line, Dot, AxisY as AxisYLine } from 'svelteplot';

	type ChartMode = 'bar' | 'line';

	let chartMode = $state<ChartMode>('bar');

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

	// Default line chart data (Date as x-axis, series as columns)
	let lineTableData = $state(`Date,Tanks,AFVs,Artillery
2024-05-10,2,5,1
2024-05-17,5,12,3
2024-05-24,9,24,6
2024-05-31,14,38,9
2024-06-07,18,47,12
2024-06-14,22,58,15`);

	// Default colors for legend items
	let legendColors = $state<Record<string, string>>({
		Destroyed: '#ff0000',
		Damaged: '#ffaa00'
	});

	let lineColors = $state<Record<string, string>>({
		Tanks: '#ff4444',
		AFVs: '#ffaa00',
		Artillery: '#44aaff'
	});

	let chartElement = $state<HTMLElement | null>(null);
	let isExporting = $state(false);
	let isLoaded = $state(false);

	// ── BAR CHART LOGIC ──────────────────────────────────────────────────────

	const parsedData = $derived.by(() => {
		const lines = tableData.trim().split('\n');
		const headers = lines[0].split(',').map((h) => h.trim());
		return lines
			.slice(1)
			.map((line) => {
				const values = line.split(',');
				const obj: Record<string, any> = {};
				headers.forEach((header, i) => {
					obj[header] = isNaN(Number(values[i])) ? values[i]?.trim() : parseInt(values[i]);
				});
				return obj;
			})
			.filter((item) =>
				Object.keys(item).some((key) => key !== 'Category' && (item[key] || 0) > 0)
			);
	});

	const legendItems = $derived.by(() => {
		if (!tableData) return [];
		return tableData
			.trim()
			.split('\n')[0]
			.split(',')
			.map((h) => h.trim())
			.filter((h) => h !== 'Category' && h !== 'Total');
	});

	const chartData = $derived.by(() => {
		const rows: { category: string; type: string; value: number }[] = [];
		for (const item of parsedData) {
			for (const legendItem of legendItems) {
				if ((item[legendItem] || 0) > 0) {
					rows.push({ category: item.Category, type: legendItem, value: item[legendItem] || 0 });
				}
			}
		}
		return rows;
	});

	const categories = $derived(parsedData.map((d) => d.Category));

	const maxValue = $derived(
		Math.max(...parsedData.flatMap((d) => legendItems.map((key) => d[key] || 0)))
	);
	const effectiveMaxValue = $derived(maxScaleValue > 0 ? maxScaleValue : maxValue);
	const colorFill = $derived((d: { type: string }) => legendColors[d.type] ?? '#888');

	// ── LINE CHART LOGIC ─────────────────────────────────────────────────────

	const parsedLineData = $derived.by(() => {
		const lines = lineTableData.trim().split('\n');
		const headers = lines[0].split(',').map((h) => h.trim());
		return lines.slice(1).map((line) => {
			const values = line.split(',');
			const obj: Record<string, any> = {};
			headers.forEach((header, i) => {
				const val = values[i]?.trim();
				if (header === headers[0]) {
					// x-axis column — keep as string (date or label)
					obj[header] = val ?? '';
				} else {
					obj[header] = isNaN(Number(val)) ? (val ?? '') : Number(val);
				}
			});
			return obj;
		});
	});

	const lineSeriesKeys = $derived.by(() => {
		if (!lineTableData) return [];
		return lineTableData
			.trim()
			.split('\n')[0]
			.split(',')
			.map((h) => h.trim())
			.slice(1); // everything after the first (x) column
	});

	const lineXKey = $derived.by(() => {
		if (!lineTableData) return 'Date';
		return lineTableData.trim().split('\n')[0].split(',')[0].trim();
	});

	// Flatten line data: { x, series, value }
	const flatLineData = $derived.by(() => {
		const rows: { x: string; series: string; value: number }[] = [];
		for (const item of parsedLineData) {
			for (const key of lineSeriesKeys) {
				rows.push({ x: item[lineXKey], series: key, value: Number(item[key]) || 0 });
			}
		}
		return rows;
	});

	// Per-series arrays for individual <Line> marks
	const lineSeriesData = $derived.by(() => {
		return lineSeriesKeys.map((key) => ({
			key,
			color: lineColors[key] ?? '#888',
			points: parsedLineData.map((row) => ({ x: row[lineXKey], y: Number(row[key]) || 0 }))
		}));
	});

	const lineMaxY = $derived.by(() => {
		const vals = flatLineData.map((d) => d.value);
		return vals.length ? Math.max(...vals) : 10;
	});

	const effectiveLineMaxY = $derived(maxScaleValue > 0 ? maxScaleValue : lineMaxY);

	const lineXDomain = $derived(parsedLineData.map((d) => d[lineXKey]));

	// Sync lineColors with current series keys
	$effect(() => {
		const defaultColors = ['#ff4444', '#ffaa00', '#44aaff', '#44ff88', '#cc44ff', '#ff8844'];
		const newColors = { ...lineColors };
		lineSeriesKeys.forEach((key, i) => {
			if (!newColors[key]) newColors[key] = defaultColors[i % defaultColors.length];
		});
		lineColors = newColors;
	});

	// Sync bar legendColors
	$effect(() => {
		const newColors = { ...legendColors };
		legendItems.forEach((item, index) => {
			if (!newColors[item]) {
				const defaultColors = ['#ff0000', '#ffaa00', '#ffdd00', '#666666'];
				newColors[item] = defaultColors[index % defaultColors.length];
			}
		});
		legendColors = newColors;
	});

	// ── STORAGE ──────────────────────────────────────────────────────────────

	onMount(async () => {
		const result = await window.storage.get('chartData').catch(() => null);
		if (result?.value) {
			const data = JSON.parse(result.value);
			if (data.title !== undefined) title = data.title;
			if (data.subtitle !== undefined) subtitle = data.subtitle;
			if (data.maxScaleValue !== undefined) maxScaleValue = data.maxScaleValue;
			if (data.tableData !== undefined) tableData = data.tableData;
			if (data.legendColors !== undefined) legendColors = data.legendColors;
			if (data.chartMode !== undefined) chartMode = data.chartMode;
			if (data.lineTableData !== undefined) lineTableData = data.lineTableData;
			if (data.lineColors !== undefined) lineColors = data.lineColors;
		}
		isLoaded = true;
	});

	$effect(() => {
		if (!isLoaded) return;
		const data = {
			title,
			subtitle,
			maxScaleValue,
			tableData,
			legendColors,
			chartMode,
			lineTableData,
			lineColors
		};
		window.storage.set('chartData', JSON.stringify(data)).catch(console.error);
	});

	// ── EXAMPLES ─────────────────────────────────────────────────────────────

	function loadExample1() {
		chartMode = 'bar';
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
		chartMode = 'bar';
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

	function loadLineExample1() {
		chartMode = 'line';
		title = 'Russian Cumulative Losses — Kharkiv Offensive';
		subtitle = 'May–June 2024';
		lineTableData = `Date,Tanks,AFVs,Artillery
2024-05-10,2,5,1
2024-05-17,5,12,3
2024-05-24,9,24,6
2024-05-31,14,38,9
2024-06-07,18,47,12
2024-06-14,22,58,15`;
	}

	function loadLineExample2() {
		chartMode = 'line';
		title = 'Frontline Change (km²) Over Time';
		subtitle = '2024 Eastern Front';
		lineTableData = `Week,Ukraine Control,Russia Control,Contested
W1,42000,38000,1200
W2,41800,38100,1250
W3,41500,38300,1300
W4,41200,38500,1400
W5,41000,38700,1350
W6,40900,38900,1200
W7,40700,39000,1100`;
	}

	// ── EXPORT ───────────────────────────────────────────────────────────────

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
				windowWidth: 2000,
				windowHeight: 800,
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
							if (computedStyle.color) htmlEl.style.color = computedStyle.color;
							if (computedStyle.borderColor) htmlEl.style.borderColor = computedStyle.borderColor;
						});
					}
				}
			});
			canvas.toBlob((blob) => {
				if (!blob) throw new Error('Failed to create image blob');
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
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
	<!-- Input Section -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body p-4">
			<h2 class="card-title text-lg">Configuration</h2>

			<!-- Chart Mode Toggle -->
			<div class="form-control">
				<label class="label py-1">
					<span class="label-text text-xs">Chart Type</span>
				</label>
				<div class="join w-full">
					<button
						class="btn join-item flex-1 btn-sm {chartMode === 'bar'
							? 'btn-primary'
							: 'btn-outline'}"
						onclick={() => (chartMode = 'bar')}
					>
						📊 Bar
					</button>
					<button
						class="btn join-item flex-1 btn-sm {chartMode === 'line'
							? 'btn-primary'
							: 'btn-outline'}"
						onclick={() => (chartMode = 'line')}
					>
						📈 Line
					</button>
				</div>
			</div>

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

			<!-- Data input — switches based on mode -->
			{#if chartMode === 'bar'}
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Table Data (CSV — first col = Category)</span>
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
						{#each legendItems as item (item)}
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
					<button class="btn btn-outline btn-xs" onclick={loadExample1}>Example 1</button>
					<button class="btn btn-outline btn-xs" onclick={loadExample2}>Example 2</button>
				</div>
			{:else}
				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Line Data (CSV — first col = X axis)</span>
					</label>
					<textarea
						class="textarea-bordered textarea h-48 font-mono text-xs"
						bind:value={lineTableData}
						placeholder="Date,Series1,Series2"
					></textarea>
				</div>

				<div class="form-control">
					<label class="label py-1">
						<span class="label-text text-xs">Series Colors</span>
					</label>
					<div class="space-y-2">
						{#each lineSeriesKeys as key (key)}
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={lineColors[key]}
									class="h-8 w-12 cursor-pointer rounded border"
								/>
								<span class="text-xs">{key}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="mt-2 flex flex-wrap gap-1">
					<button class="btn btn-outline btn-xs" onclick={loadLineExample1}>Example 1</button>
					<button class="btn btn-outline btn-xs" onclick={loadLineExample2}>Example 2</button>
				</div>
			{/if}

			<button class="btn mt-2 btn-sm btn-primary" onclick={exportAsImage} disabled={isExporting}>
				{isExporting ? 'Exporting...' : '📸 Export'}
			</button>
		</div>
	</div>

	<!-- Chart Section -->
	<div class="card text-neutral-content shadow-xl lg:col-span-2">
		<div class="card-body">
			<div bind:this={chartElement} data-export-chart class="relative p-4 pr-6">
				<!-- Branding Component -->
				<Branding isMobile={false} />

				<!-- Title -->
				<div class="mb-6 text-center">
					<h3 class="text-md font-semibold md:text-base">{title}</h3>
					{#if subtitle && subtitle.trim()}
						<div class="mx-auto my-2 h-px w-48 bg-gray-600"></div>
						<p class="text-xs text-gray-400 md:text-sm">{subtitle}</p>
					{/if}
				</div>

				{#if chartMode === 'bar'}
					<!-- ── BAR CHART ── -->
					<Plot
						height={Math.max(200, categories.length * 36 + 60)}
						marginLeft={140}
						marginBottom={30}
						marginRight={40}
						x={{ domain: [0, effectiveMaxValue], grid: true, tickCount: 5 }}
						y={{ domain: [...categories].reverse(), padding: 0.2 }}
						style="background: transparent; color: #9ca3af; font-size: 12px;"
					>
						<BarX data={chartData} x="value" y="category" fill={colorFill} stack inset={1} />
						<AxisX tickFormat={(d) => String(d)} style="color: #00ff00; font-size: 11px;" />
						<AxisY style="color: #e5e7eb; font-size: 11px;" />
						<RuleX x={0} />
					</Plot>

					<!-- Bar Legend -->
					<div class="mt-4 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
						{#each legendItems as item (item)}
							<div class="flex items-center gap-2">
								<div class="size-4 rounded" style="background-color: {legendColors[item]}" />
								<span>{item}</span>
							</div>
						{/each}
					</div>
				{:else}
					<!-- ── LINE CHART ── -->
					<Plot
						height={Math.max(220, 300)}
						marginLeft={50}
						marginBottom={50}
						marginRight={20}
						marginTop={10}
						x={{ domain: lineXDomain, grid: true, padding: 0.05 }}
						y={{ domain: [0, effectiveLineMaxY], grid: true, tickCount: 6 }}
						style="background: transparent; color: #9ca3af; font-size: 12px;"
					>
						{#each lineSeriesData as series (series.key)}
							<Line data={series.points} x="x" y="y" stroke={series.color} strokeWidth={2} />
							<Dot data={series.points} x="x" y="y" fill={series.color} r={3} />
						{/each}
						<AxisX
							tickFormat={(d) => String(d)}
							style="color: #00ff00; font-size: 11px;"
							tickRotate={lineXDomain.length > 6 ? -35 : 0}
						/>
						<AxisYLine style="color: #e5e7eb; font-size: 11px;" />
					</Plot>

					<!-- Line Legend -->
					<div class="mt-2 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
						{#each lineSeriesData as series (series.key)}
							<div class="flex items-center gap-2">
								<div class="h-0.5 w-6 rounded" style="background-color: {series.color}"></div>
								<div class="size-2 rounded-full" style="background-color: {series.color}"></div>
								<span>{series.key}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
