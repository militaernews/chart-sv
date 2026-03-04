<!-- +page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas-pro';
	import Branding from '$lib/components/Branding.svelte';
	import { Plot, BarX, RuleX, AxisX, AxisY, Line, Dot } from 'svelteplot';

	type ChartMode = 'bar' | 'line';
	type ColType = 'text' | 'number' | 'date';

	const COL_TYPE_ICONS: Record<ColType, string> = { text: 'T', number: '#', date: '📅' };
	const COL_TYPE_CYCLE: ColType[] = ['text', 'number', 'date'];

	// ── STATE────

	let chartMode = $state<ChartMode>('bar');
	let title = $state('Russian Losses in Kharkiv');
	let subtitle = $state('as of June 3, 2024');
	let maxScaleValue = $state(0);

	type TableState = {
		headers: string[];
		colTypes: ColType[]; // one per column
		rows: string[][];
	};

	let barTable = $state<TableState>({
		headers: ['Category', 'Destroyed', 'Damaged'],
		colTypes: ['text', 'number', 'number'],
		rows: [
			['Panzer', '9', '0'],
			['Schützenpanzer', '13', '0'],
			['Gepanzerte Fahrzeuge', '1', '0'],
			['Mehrfachraktenwerfer', '0', '0'],
			['Selbstfahrlafetten', '0', '0'],
			['Gezogene Artillerie', '0', '0'],
			['Luftverteidigungssysteme', '2', '0'],
			['Führungsfahrzeuge', '0', '0'],
			['Pionierfahrzeuge', '10', '1'],
			['Radare und Jammer', '1', '0'],
			['Lastkraftwagen', '6', '1'],
			['Helikopter', '0', '0'],
			['UAVs', '0', '0']
		]
	});

	let lineTable = $state<TableState>({
		headers: ['Date', 'Tanks', 'AFVs', 'Artillery'],
		colTypes: ['date', 'number', 'number', 'number'],
		rows: [
			['2024-05-10', '2', '5', '1'],
			['2024-05-17', '5', '12', '3'],
			['2024-05-24', '9', '24', '6'],
			['2024-05-31', '14', '38', '9'],
			['2024-06-07', '18', '47', '12'],
			['2024-06-14', '22', '58', '15']
		]
	});

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
	let csvPasteVisible = $state(false);
	let csvPasteText = $state('');
	let csvPasteError = $state('');

	// ── TYPE DETECTION ────────────────────────────────────────────────────────

	const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{2}[./]\d{2}[./]\d{4}$/;

	function detectColType(values: string[]): ColType {
		const nonEmpty = values.filter((v) => v.trim() !== '');
		if (nonEmpty.length === 0) return 'text';
		if (nonEmpty.every((v) => DATE_RE.test(v.trim()))) return 'date';
		if (nonEmpty.every((v) => !isNaN(Number(v.trim())))) return 'number';
		return 'text';
	}

	function inferColTypes(headers: string[], rows: string[][]): ColType[] {
		return headers.map((_, colIdx) => detectColType(rows.map((r) => r[colIdx] ?? '')));
	}

	// ── CSV HELPERS ───────────────────────────────────────────────────────────

	function csvToTable(csv: string): TableState | null {
		const lines = csv.trim().split(/\r?\n/).filter(Boolean);
		if (lines.length < 2) return null;
		const headers = lines[0].split(',').map((s) => s.trim());
		if (headers.length < 2) return null;
		const rows = lines.slice(1).map((line) => {
			const cells = line.split(',');
			while (cells.length < headers.length) cells.push('');
			return cells.slice(0, headers.length).map((s) => s.trim());
		});
		return { headers, colTypes: inferColTypes(headers, rows), rows };
	}

	// ── CURRENT TABLE ─────────────────────────────────────────────────────────

	const currentTable = $derived(chartMode === 'bar' ? barTable : lineTable);

	function setCurrentTable(t: TableState) {
		if (chartMode === 'bar') barTable = t;
		else lineTable = t;
	}

	// ── TABLE EDITING ─────────────────────────────────────────────────────────

	function updateCell(rowIdx: number, colIdx: number, val: string) {
		const src = chartMode === 'bar' ? barTable : lineTable;
		const t: TableState = { ...src, rows: src.rows.map((r) => [...r]) };
		t.rows[rowIdx][colIdx] = val;
		setCurrentTable(t);
	}

	function updateHeader(colIdx: number, val: string) {
		const t: TableState = { ...currentTable, headers: [...currentTable.headers] };
		t.headers[colIdx] = val;
		setCurrentTable(t);
	}

	function cycleColType(colIdx: number) {
		const t: TableState = { ...currentTable, colTypes: [...currentTable.colTypes] };
		const cur = t.colTypes[colIdx] ?? 'text';
		const next = COL_TYPE_CYCLE[(COL_TYPE_CYCLE.indexOf(cur) + 1) % COL_TYPE_CYCLE.length];
		t.colTypes[colIdx] = next;
		setCurrentTable(t);
	}

	function addRow() {
		const t: TableState = {
			...currentTable,
			rows: [
				...currentTable.rows,
				currentTable.headers.map((_, i) => {
					const type = currentTable.colTypes[i] ?? 'text';
					if (i === 0 && type === 'text') return 'New';
					if (type === 'date') return new Date().toISOString().slice(0, 10);
					return '0';
				})
			]
		};
		setCurrentTable(t);
	}

	function removeRow(idx: number) {
		setCurrentTable({ ...currentTable, rows: currentTable.rows.filter((_, i) => i !== idx) });
	}

	function addColumn() {
		const name = `Col${currentTable.headers.length}`;
		setCurrentTable({
			headers: [...currentTable.headers, name],
			colTypes: [...currentTable.colTypes, 'number'],
			rows: currentTable.rows.map((r) => [...r, '0'])
		});
	}

	function removeColumn(colIdx: number) {
		if (currentTable.headers.length <= 2) return;
		setCurrentTable({
			headers: currentTable.headers.filter((_, i) => i !== colIdx),
			colTypes: currentTable.colTypes.filter((_, i) => i !== colIdx),
			rows: currentTable.rows.map((r) => r.filter((_, i) => i !== colIdx))
		});
	}

	function applyCSVPaste() {
		csvPasteError = '';
		const parsed = csvToTable(csvPasteText);
		if (!parsed) {
			csvPasteError = 'Could not parse CSV. Ensure at least 2 columns and a header row.';
			return;
		}
		setCurrentTable(parsed);
		csvPasteText = '';
		csvPasteVisible = false;
	}

	// ── BAR CHART DERIVED ─────────────────────────────────────────────────────

	const legendItems = $derived(barTable.headers.slice(1).filter((h) => h !== 'Total'));

	const parsedBarData = $derived.by(() =>
		barTable.rows
			.map((row) => {
				const obj: Record<string, any> = { Category: row[0] };
				barTable.headers.slice(1).forEach((h, i) => {
					obj[h] = Number(row[i + 1]) || 0;
				});
				return obj;
			})
			.filter((item) => legendItems.some((k) => (item[k] || 0) > 0))
	);

	const barChartData = $derived.by(() => {
		const rows: { category: string; type: string; value: number }[] = [];
		for (const item of parsedBarData)
			for (const key of legendItems)
				if ((item[key] || 0) > 0)
					rows.push({ category: item.Category, type: key, value: item[key] });
		return rows;
	});

	const barCategories = $derived(parsedBarData.map((d) => d.Category));
	const barMaxValue = $derived(
		Math.max(1, ...parsedBarData.flatMap((d) => legendItems.map((k) => d[k] || 0)))
	);
	const effectiveBarMax = $derived(maxScaleValue > 0 ? maxScaleValue : barMaxValue);
	const colorFill = $derived((d: { type: string }) => legendColors[d.type] ?? '#888');

	$effect(() => {
		const defaults = ['#ff0000', '#ffaa00', '#ffdd00', '#666666'];
		const c = { ...legendColors };
		legendItems.forEach((item, i) => {
			if (!c[item]) c[item] = defaults[i % defaults.length];
		});
		legendColors = c;
	});

	// ── LINE CHART DERIVED ────────────────────────────────────────────────────

	const lineSeriesKeys = $derived(lineTable.headers.slice(1));

	const lineSeriesData = $derived.by(() =>
		lineSeriesKeys.map((key) => ({
			key,
			color: lineColors[key] ?? '#888',
			points: lineTable.rows.map((row) => ({
				x: row[0],
				y: Number(row[lineTable.headers.indexOf(key)]) || 0
			}))
		}))
	);

	const lineMaxY = $derived(
		Math.max(
			1,
			...lineTable.rows.flatMap((row) => lineSeriesKeys.map((_, i) => Number(row[i + 1]) || 0))
		)
	);
	const effectiveLineMax = $derived(maxScaleValue > 0 ? maxScaleValue : lineMaxY);
	const lineXDomain = $derived(lineTable.rows.map((r) => r[0]));

	$effect(() => {
		const defaults = ['#ff4444', '#ffaa00', '#44aaff', '#44ff88', '#cc44ff'];
		const c = { ...lineColors };
		lineSeriesKeys.forEach((k, i) => {
			if (!c[k]) c[k] = defaults[i % defaults.length];
		});
		lineColors = c;
	});

	// ── STORAGE──

	onMount(async () => {
		const result = await window.storage.get('chartDataV3').catch(() => null);
		if (result?.value) {
			try {
				const data = JSON.parse(result.value);
				if (data.title) title = data.title;
				if (data.subtitle !== undefined) subtitle = data.subtitle;
				if (data.maxScaleValue !== undefined) maxScaleValue = data.maxScaleValue;
				if (data.barTable) barTable = data.barTable;
				if (data.lineTable) lineTable = data.lineTable;
				if (data.legendColors) legendColors = data.legendColors;
				if (data.lineColors) lineColors = data.lineColors;
				if (data.chartMode) chartMode = data.chartMode;
			} catch {}
		}
		isLoaded = true;
	});

	$effect(() => {
		if (!isLoaded) return;
		window.storage
			.set(
				'chartDataV3',
				JSON.stringify({
					title,
					subtitle,
					maxScaleValue,
					barTable,
					lineTable,
					legendColors,
					lineColors,
					chartMode
				})
			)
			.catch(console.error);
	});

	// ── EXAMPLES

	function loadBarExample1() {
		chartMode = 'bar';
		title = 'Russian Losses in Kharkiv';
		subtitle = 'June 3, 2024';
		barTable = {
			headers: ['Category', 'Destroyed', 'Damaged'],
			colTypes: ['text', 'number', 'number'],
			rows: [
				['Panzer', '9', '0'],
				['Schützenpanzer', '13', '0'],
				['Gepanzerte Fahrzeuge', '1', '0'],
				['Mehrfachraktenwerfer', '0', '0'],
				['Selbstfahrlafetten', '0', '0'],
				['Pionierfahrzeuge', '10', '1'],
				['Radare und Jammer', '1', '0'],
				['Lastkraftwagen', '6', '1']
			]
		};
	}
	function loadBarExample2() {
		chartMode = 'bar';
		title = 'Russian 2024 Kharkiv Offensive Losses';
		subtitle = 'as of 2024-08-26';
		barTable = {
			headers: ['Category', 'Destroyed', 'Abandoned', 'Captured', 'Damaged'],
			colTypes: ['text', 'number', 'number', 'number', 'number'],
			rows: [
				['Tanks', '22', '0', '2', '0'],
				['AFVs', '58', '0', '0', '1'],
				['IMVs', '4', '0', '0', '0'],
				['MLRS', '1', '0', '0', '0'],
				['SP Artillery', '1', '0', '0', '2'],
				['AA Systems', '3', '0', '0', '0'],
				['Engineering', '22', '1', '0', '3'],
				['Radars', '1', '0', '0', '1'],
				['Trucks', '36', '0', '0', '1'],
				['Drones', '3', '0', '0', '0']
			]
		};
	}
	function loadLineExample1() {
		chartMode = 'line';
		title = 'Russian Cumulative Losses — Kharkiv';
		subtitle = 'May–June 2024';
		lineTable = {
			headers: ['Date', 'Tanks', 'AFVs', 'Artillery'],
			colTypes: ['date', 'number', 'number', 'number'],
			rows: [
				['2024-05-10', '2', '5', '1'],
				['2024-05-17', '5', '12', '3'],
				['2024-05-24', '9', '24', '6'],
				['2024-05-31', '14', '38', '9'],
				['2024-06-07', '18', '47', '12'],
				['2024-06-14', '22', '58', '15']
			]
		};
	}
	function loadLineExample2() {
		chartMode = 'line';
		title = 'Frontline Change (km²) Over Time';
		subtitle = '2024 Eastern Front';
		lineTable = {
			headers: ['Week', 'Ukraine', 'Russia', 'Contested'],
			colTypes: ['text', 'number', 'number', 'number'],
			rows: [
				['W1', '42000', '38000', '1200'],
				['W2', '41800', '38100', '1250'],
				['W3', '41500', '38300', '1300'],
				['W4', '41200', '38500', '1400'],
				['W5', '41000', '38700', '1350'],
				['W6', '40900', '38900', '1200'],
				['W7', '40700', '39000', '1100']
			]
		};
	}

	// ── EXPORT───

	async function exportAsImage() {
		if (!chartElement) return;
		isExporting = true;
		try {
			await new Promise((r) => setTimeout(r, 100));
			const canvas = await html2canvas(chartElement, {
				backgroundColor: '#1a1a1a',
				scale: 2,
				logging: false,
				useCORS: true,
				allowTaint: true,
				onclone: (doc) => {
					doc
						.querySelector('[data-export-chart]')
						?.querySelectorAll('*')
						.forEach((el) => {
							const h = el as HTMLElement;
							const cs = window.getComputedStyle(h);
							if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)')
								h.style.backgroundColor = cs.backgroundColor;
							if (cs.color) h.style.color = cs.color;
						});
				}
			});
			canvas.toBlob((blob) => {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
				a.href = url;
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 100);
			}, 'image/png');
		} catch (e) {
			console.error(e);
			alert('Export failed.');
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
	<!-- ── CONFIG PANEL ── -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body space-y-3 p-4">
			<h2 class="card-title text-lg">Configuration</h2>

			<div class="join w-full">
				<button
					class="btn join-item flex-1 btn-sm {chartMode === 'bar' ? 'btn-primary' : 'btn-outline'}"
					onclick={() => (chartMode = 'bar')}>📊 Bar</button
				>
				<button
					class="btn join-item flex-1 btn-sm {chartMode === 'line' ? 'btn-primary' : 'btn-outline'}"
					onclick={() => (chartMode = 'line')}>📈 Line</button
				>
			</div>

			<div class="form-control">
				<label class="label py-1"><span class="label-text text-xs">Chart Title</span></label>
				<input type="text" bind:value={title} class="input-bordered input input-sm" />
			</div>
			<div class="form-control">
				<label class="label py-1"><span class="label-text text-xs">Subtitle / Date</span></label>
				<input type="text" bind:value={subtitle} class="input-bordered input input-sm" />
			</div>
			<div class="form-control">
				<label class="label py-1"
					><span class="label-text text-xs">Max Scale (0 = auto)</span></label
				>
				<input
					type="number"
					bind:value={maxScaleValue}
					class="input-bordered input input-sm"
					min="0"
				/>
			</div>

			<div class="form-control">
				<label class="label py-1"><span class="label-text text-xs">Series Colors</span></label>
				<div class="space-y-1">
					<!-- FIX 1: Split ternary bind into two separate #if blocks -->
					{#if chartMode === 'bar'}
						{#each legendItems as key (key)}
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={legendColors[key]}
									class="h-7 w-10 cursor-pointer rounded border"
								/>
								<span class="truncate text-xs">{key}</span>
							</div>
						{/each}
					{:else}
						{#each lineSeriesKeys as key (key)}
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={lineColors[key]}
									class="h-7 w-10 cursor-pointer rounded border"
								/>
								<span class="truncate text-xs">{key}</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<div>
				<p class="mb-1 text-xs text-base-content/50">Examples</p>
				<div class="flex flex-wrap gap-1">
					{#if chartMode === 'bar'}
						<button class="btn btn-outline btn-xs" onclick={loadBarExample1}>Bar 1</button>
						<button class="btn btn-outline btn-xs" onclick={loadBarExample2}>Bar 2</button>
					{:else}
						<button class="btn btn-outline btn-xs" onclick={loadLineExample1}>Line 1</button>
						<button class="btn btn-outline btn-xs" onclick={loadLineExample2}>Line 2</button>
					{/if}
				</div>
			</div>

			<button class="btn w-full btn-sm btn-primary" onclick={exportAsImage} disabled={isExporting}>
				{isExporting ? 'Exporting…' : '📸 Export PNG'}
			</button>
		</div>
	</div>

	<!-- ── CHART + TABLE PANEL ── -->
	<div class="flex flex-col gap-4 lg:col-span-2">
		<!-- Chart -->
		<div class="card text-neutral-content shadow-xl">
			<div class="card-body p-4">
				<div bind:this={chartElement} data-export-chart class="relative p-4 pr-6">
					<Branding isMobile={false} />
					<div class="mb-6 text-center">
						<h3 class="text-md font-semibold md:text-base">{title}</h3>
						{#if subtitle?.trim()}
							<div class="mx-auto my-2 h-px w-48 bg-gray-600"></div>
							<p class="text-xs text-gray-400 md:text-sm">{subtitle}</p>
						{/if}
					</div>

					{#if chartMode === 'bar'}
						<Plot
							height={Math.max(200, barCategories.length * 36 + 60)}
							marginLeft={140}
							marginBottom={30}
							marginRight={40}
							x={{ domain: [0, effectiveBarMax], grid: true, ticks: 5 }}
							y={{ domain: [...barCategories].reverse(), padding: 0.2 }}
							style="background: transparent; color: #9ca3af; font-size: 12px;"
						>
							<BarX data={barChartData} x="value" y="category" fill={colorFill} inset={1} />
							<AxisX tickFormat={(d) => String(d)} style="color: #00ff00; font-size: 11px;" />
							<AxisY style="color: #e5e7eb; font-size: 11px;" />
							<RuleX x={0} />
						</Plot>
						<div class="mt-4 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
							{#each legendItems as item (item)}
								<div class="flex items-center gap-2">
									<div class="size-4 rounded" style="background-color: {legendColors[item]}"></div>
									<span>{item}</span>
								</div>
							{/each}
						</div>
					{:else}
						<Plot
							height={300}
							marginLeft={50}
							marginBottom={50}
							marginRight={20}
							marginTop={10}
							x={{ domain: lineXDomain, grid: true, padding: 0.05 }}
							y={{ domain: [0, effectiveLineMax], grid: true, ticks: 6 }}
							style="background: transparent; color: #9ca3af; font-size: 12px;"
						>
							{#each lineSeriesData as series (series.key)}
								<Line data={series.points} x="x" y="y" stroke={series.color} strokeWidth={2} />
								<Dot data={series.points} x="x" y="y" fill={series.color} r={3} />
							{/each}
							<AxisX tickFormat={(d) => String(d)} style="color: #00ff00; font-size: 11px;" />
							<AxisY style="color: #e5e7eb; font-size: 11px;" />
						</Plot>
						<div class="mt-2 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
							{#each lineSeriesData as s (s.key)}
								<div class="flex items-center gap-2">
									<div class="h-0.5 w-5 rounded" style="background-color:{s.color}"></div>
									<div class="size-2 rounded-full" style="background-color:{s.color}"></div>
									<span>{s.key}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Data Editor -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body p-4">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 class="card-title text-base">Data Editor</h2>
					<div class="flex flex-wrap gap-1">
						<button class="btn btn-outline btn-xs" onclick={addRow}>+ Row</button>
						<button class="btn btn-outline btn-xs" onclick={addColumn}>+ Col</button>
						<button
							class="btn btn-xs {csvPasteVisible ? 'btn-warning' : 'btn-outline'}"
							onclick={() => {
								csvPasteVisible = !csvPasteVisible;
								csvPasteError = '';
							}}
						>
							{csvPasteVisible ? '✕ Cancel' : '📋 Paste CSV'}
						</button>
					</div>
				</div>

				<!-- CSV paste drawer -->
				{#if csvPasteVisible}
					<div
						class="mb-4 space-y-2 rounded-xl border border-dashed border-base-300 bg-base-200/60 p-3"
					>
						<p class="text-xs text-base-content/60">
							Paste CSV — first row = headers, first column = category / x-axis. Column types are
							auto-detected.
						</p>
						<textarea
							class="textarea-bordered textarea h-28 w-full font-mono text-xs"
							bind:value={csvPasteText}
							placeholder="Category,Destroyed,Damaged&#10;Tanks,5,2&#10;AFVs,12,3"
						></textarea>
						{#if csvPasteError}
							<p class="text-xs text-error">{csvPasteError}</p>
						{/if}
						<button
							class="btn btn-sm btn-primary"
							onclick={applyCSVPaste}
							disabled={!csvPasteText.trim()}
						>
							Apply CSV →
						</button>
					</div>
				{/if}

				<!-- Editable table -->
				<div class="overflow-x-auto rounded-lg border border-base-300">
					<table class="table w-full table-xs">
						<thead>
							<tr class="bg-base-200">
								{#each currentTable.headers as header, colIdx (colIdx)}
									{@const colType = currentTable.colTypes[colIdx] ?? 'text'}
									<th class="p-0">
										<div class="group flex flex-col">
											<!-- type badge + delete -->
											<div class="flex items-center justify-between gap-1 px-1 pt-1">
												<button
													class="badge shrink-0 cursor-pointer font-mono badge-xs transition-colors select-none hover:badge-primary
														{colType === 'number' ? 'badge-accent' : colType === 'date' ? 'badge-info' : 'badge-ghost'}"
													onclick={() => cycleColType(colIdx)}
													title="Click to cycle type: text → number → date"
												>
													{COL_TYPE_ICONS[colType]}
												</button>
												{#if currentTable.headers.length > 2 && colIdx > 0}
													<button
														class="px-0.5 text-xs leading-none text-error opacity-0 transition-opacity group-hover:opacity-100"
														onclick={() => removeColumn(colIdx)}
														title="Remove column">✕</button
													>
												{/if}
											</div>
											<!-- header name input -->
											<input
												type="text"
												value={header}
												oninput={(e) => updateHeader(colIdx, (e.target as HTMLInputElement).value)}
												class="input input-xs w-full min-w-16 input-ghost px-2 text-xs font-semibold focus:bg-base-100"
											/>
										</div>
									</th>
								{/each}
								<th class="w-6 p-0"></th>
							</tr>
						</thead>
						<tbody>
							{#each currentTable.rows as row, rowIdx (rowIdx)}
								<tr class="group hover:bg-base-200/40">
									{#each row as cell, colIdx (colIdx)}
										{@const colType = currentTable.colTypes[colIdx] ?? 'text'}
										<td class="p-0">
											<input
												type={colType === 'number'
													? 'number'
													: colType === 'date'
														? 'date'
														: 'text'}
												value={cell}
												oninput={(e) =>
													updateCell(rowIdx, colIdx, (e.target as HTMLInputElement).value)}
												class="input input-xs w-full min-w-12 input-ghost px-2 text-xs focus:bg-base-100
													{colType === 'number' ? 'text-right tabular-nums' : ''}"
											/>
										</td>
									{/each}
									<td class="w-6 p-0">
										<button
											class="btn px-1 text-error opacity-0 btn-ghost btn-xs group-hover:opacity-100"
											onclick={() => removeRow(rowIdx)}
											title="Delete row">✕</button
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Legend -->
				<div class="mt-2 flex flex-wrap gap-3 text-xs text-base-content/50">
					<span class="flex items-center gap-1">
						<span class="badge badge-ghost font-mono badge-xs">T</span> text
					</span>
					<span class="flex items-center gap-1">
						<span class="badge font-mono badge-xs badge-accent">#</span> number
					</span>
					<span class="flex items-center gap-1">
						<span class="badge font-mono badge-xs badge-info">📅</span> date
					</span>
					<span class="ml-auto">Click a badge to cycle the column type.</span>
				</div>
			</div>
		</div>
	</div>
</div>
