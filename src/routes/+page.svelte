<!-- +page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas-pro';
	import Branding from '$lib/components/Branding.svelte';
	import { Plot, BarX, RuleX, AxisX, AxisY, Line, Dot, Text } from 'svelteplot';
	import IBarChart from '~icons/fluent/chart-multiple-24-regular';
	import ILineChart from '~icons/fluent/arrow-trending-24-regular';
	import ICamera from '~icons/fluent/camera-16-regular';
	import IClipboard from '~icons/fluent/clipboard-paste-20-regular';
	import IDismiss from '~icons/fluent/dismiss-16-regular';
	import ISettings from '~icons/fluent/settings-16-regular';
	import ILandscape from '~icons/fluent/rectangle-landscape-24-regular';
	import IPortrait from '~icons/fluent/rectangle-portrait-24-regular';
	import ITune from '~icons/fluent/options-24-regular';
	import ITable from '~icons/fluent/table-24-regular';

	type ChartMode = 'bar' | 'line';
	type Orientation = 'landscape' | 'portrait';
	type ColType = 'text' | 'number' | 'date';

	const COL_TYPE_CYCLE: ColType[] = ['text', 'number', 'date'];

	// Portrait keeps the figure narrow (good for phone/story-format shares);
	// landscape lets it fill the panel width (good for wide news-post images).
	// Line charts also grow taller in portrait since the width can't do the
	// work of conveying "tall" the way it does for bar-height-by-category.
	const PORTRAIT_MAX_WIDTH = 560;
	const LINE_HEIGHT: Record<Orientation, number> = { landscape: 300, portrait: 420 };

	// ── STATE

	let chartMode = $state<ChartMode>('bar');
	let orientation = $state<Orientation>('landscape');
	let title = $state('Russian Losses in Kharkiv');
	let subtitle = $state('as of June 3, 2024');
	let maxScaleValue = $state(0);
	let showAxisLabels = $state(false);
	let xAxisLabel = $state('');
	let yAxisLabel = $state('');

	type TableState = {
		headers: string[];
		colTypes: ColType[];
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
	let csvPasteError = $state('');

	async function pasteCSVFromClipboard() {
		csvPasteError = '';
		try {
			const text = await navigator.clipboard.readText();
			if (!text?.trim()) {
				csvPasteError = 'Clipboard is empty.';
				return;
			}
			const parsed = csvToTable(text);
			if (!parsed) {
				csvPasteError = 'Could not parse clipboard as CSV — need ≥2 columns and a header row.';
				return;
			}
			if (chartMode === 'bar') barTable = parsed;
			else lineTable = parsed;
		} catch {
			csvPasteError = 'Clipboard access denied. Please allow clipboard permissions and try again.';
		}
	}
	// ── COLUMN SETTINGS MODAL ─────────────────────────────────────────────────

	let modalOpen = $state(false);
	let modalColIdx = $state(0);

	const modalColType = $derived(
		chartMode === 'bar'
			? (barTable.colTypes[modalColIdx] ?? 'text')
			: (lineTable.colTypes[modalColIdx] ?? 'text')
	);

	const modalColor = $derived(
		chartMode === 'bar'
			? (legendColors[barTable.headers[modalColIdx]] ?? '#888888')
			: (lineColors[lineTable.headers[modalColIdx]] ?? '#888888')
	);

	function openColModal(e: MouseEvent, colIdx: number) {
		e.stopPropagation();
		e.preventDefault();
		modalColIdx = colIdx;
		modalOpen = true;
	}

	function setModalColType(t: ColType) {
		if (chartMode === 'bar') barTable.colTypes[modalColIdx] = t;
		else lineTable.colTypes[modalColIdx] = t;
	}

	function setModalColor(color: string) {
		const key =
			chartMode === 'bar' ? barTable.headers[modalColIdx] : lineTable.headers[modalColIdx];
		if (!key) return;
		if (chartMode === 'bar') legendColors[key] = color;
		else lineColors[key] = color;
	}

	// ── TABLE MUTATIONS ───────────────────────────────────────────────────────

	function tbl(): TableState {
		return chartMode === 'bar' ? barTable : lineTable;
	}

	function addRow() {
		const t = tbl();
		t.rows.push(
			t.headers.map((_, i) => {
				const type = t.colTypes[i] ?? 'text';
				if (i === 0 && type === 'text') return 'New';
				if (type === 'date') return new Date().toISOString().slice(0, 10);
				return '0';
			})
		);
	}

	function removeRow(idx: number) {
		tbl().rows.splice(idx, 1);
	}

	function addColumn() {
		const t = tbl();
		const name = `Col${t.headers.length}`;
		t.headers.push(name);
		t.colTypes.push('number');
		t.rows.forEach((r) => r.push('0'));
	}

	function removeColumn(colIdx: number) {
		const t = tbl();
		if (t.headers.length <= 2) return;
		t.headers.splice(colIdx, 1);
		t.colTypes.splice(colIdx, 1);
		t.rows.forEach((r) => r.splice(colIdx, 1));
	}

	// ── CSV ───

	const DATE_RE = /^\d{4}-\d{2}-\d{2}$|^\d{2}[./]\d{2}[./]\d{4}$/;

	function detectColType(values: string[]): ColType {
		const ne = values.filter((v) => v.trim() !== '');
		if (!ne.length) return 'text';
		if (ne.every((v) => DATE_RE.test(v.trim()))) return 'date';
		if (ne.every((v) => !isNaN(Number(v.trim())))) return 'number';
		return 'text';
	}

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
		const colTypes = headers.map((_, ci) => detectColType(rows.map((r) => r[ci] ?? '')));
		return { headers, colTypes, rows };
	}

	// ── BAR CHART DERIVED ─────────────────────────────────────────────────────

	const legendItems = $derived(barTable.headers.slice(1).filter((h) => h !== 'Total'));

	const parsedBarData = $derived.by(() =>
		barTable.rows
			.filter((row) => row[0]?.trim())
			.map((row) => {
				const obj: Record<string, any> = { Category: row[0] };
				barTable.headers.slice(1).forEach((h, i) => {
					obj[h] = Number(row[i + 1]) || 0;
				});
				return obj;
			})
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
	const barMaxValue = $derived.by(() => {
		const vals = parsedBarData.flatMap((d) => legendItems.map((k) => d[k] || 0));
		return vals.length > 0 ? Math.max(1, ...vals) : 1;
	});
	const effectiveBarMax = $derived(maxScaleValue > 0 ? maxScaleValue : barMaxValue);
	const colorFill = $derived((d: { type: string }) => legendColors[d.type] ?? '#888');

	const barSegmentLabels = $derived.by(() => {
		const labels: { category: string; x: number; label: string }[] = [];
		for (const item of parsedBarData) {
			let offset = 0;
			for (const key of legendItems) {
				const v = item[key] || 0;
				if (v > 0) {
					labels.push({ category: item.Category, x: offset + v / 2, label: String(v) });
					offset += v;
				}
			}
		}
		return labels;
	});

	const barTotalLabels = $derived.by(() =>
		parsedBarData
			.map((item) => {
				const total = legendItems.reduce((s, k) => s + (item[k] || 0), 0);
				return { category: item.Category, x: total, label: String(total) };
			})
			.filter((d) => d.label !== '0')
	);

	$effect(() => {
		const defaults = ['#ff0000', '#ffaa00', '#ffdd00', '#666666'];
		const missing = legendItems.filter((item) => !legendColors[item]);
		if (missing.length === 0) return;
		const c = { ...legendColors };
		missing.forEach((item, i) => {
			c[item] = defaults[legendItems.indexOf(item) % defaults.length];
		});
		legendColors = c;
	});

	// ── LINE CHART DERIVED ────────────────────────────────────────────────────

	const lineSeriesKeys = $derived(lineTable.headers.slice(1));

	const lineSeriesData = $derived.by(() =>
		lineSeriesKeys.map((key, ki) => ({
			key,
			color: lineColors[key] ?? '#888',
			points: lineTable.rows.map((row) => ({
				x: row[0],
				y: Number(row[ki + 1] ?? 0) || 0
			}))
		}))
	);

	const lineMaxY = $derived.by(() => {
		const vals = lineTable.rows.flatMap((row) =>
			lineSeriesKeys.map((_, i) => Number(row[i + 1] ?? 0) || 0)
		);
		return vals.length > 0 ? Math.max(1, ...vals) : 1;
	});

	const effectiveLineMax = $derived(maxScaleValue > 0 ? maxScaleValue : lineMaxY);
	const lineXDomain = $derived(lineTable.rows.map((r) => r[0]));

	$effect(() => {
		const defaults = ['#ff4444', '#ffaa00', '#44aaff', '#44ff88', '#cc44ff'];
		const missing = lineSeriesKeys.filter((k) => !lineColors[k]);
		if (missing.length === 0) return;
		const c = { ...lineColors };
		missing.forEach((k) => {
			c[k] = defaults[lineSeriesKeys.indexOf(k) % defaults.length];
		});
		lineColors = c;
	});

	// ── STORAGE ───────────────────────────────────────────────────────────────

	onMount(async () => {
		const result = (await window.storage?.get('chartDataV4').catch(() => null)) ?? null;
		if (result?.value) {
			try {
				const data = JSON.parse(result.value);
				if (data.title) title = data.title;
				if (data.subtitle !== undefined) subtitle = data.subtitle;
				if (data.maxScaleValue !== undefined) maxScaleValue = data.maxScaleValue;
				if (data.showAxisLabels !== undefined) showAxisLabels = data.showAxisLabels;
				if (data.xAxisLabel !== undefined) xAxisLabel = data.xAxisLabel;
				if (data.yAxisLabel !== undefined) yAxisLabel = data.yAxisLabel;
				if (data.barTable) barTable = data.barTable;
				if (data.lineTable) lineTable = data.lineTable;
				if (data.legendColors) legendColors = data.legendColors;
				if (data.lineColors) lineColors = data.lineColors;
				if (data.chartMode) chartMode = data.chartMode;
				if (data.orientation) orientation = data.orientation;
			} catch {}
		}
		isLoaded = true;
	});

	$effect(() => {
		if (!isLoaded) return;
		window.storage
			?.set(
				'chartDataV4',
				JSON.stringify({
					title,
					subtitle,
					maxScaleValue,
					showAxisLabels,
					xAxisLabel,
					yAxisLabel,
					barTable,
					lineTable,
					legendColors,
					lineColors,
					chartMode,
					orientation
				})
			)
			.catch(console.error);
	});

	// ── EXAMPLES ──────────────────────────────────────────────────────────────

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

	// ── LAYOUT

	const figureStyle = $derived(
		orientation === 'portrait' ? `max-width:${PORTRAIT_MAX_WIDTH}px` : ''
	);
	const lineHeight = $derived(LINE_HEIGHT[orientation]);

	// ── EXPORT

	async function exportAsImage() {
		if (!chartElement) return;
		isExporting = true;
		try {
			await new Promise((r) => setTimeout(r, 100));
			const canvas = await html2canvas(chartElement, {
				backgroundColor: '#141214',
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

<!-- ── COLUMN SETTINGS MODAL -->
<dialog id="col_settings_modal" class="modal" class:modal-open={modalOpen}>
	<div class="modal-box w-80" onclick={(e) => e.stopPropagation()}>
		<div class="mb-4 flex items-center justify-between">
			<h3 class="text-base font-semibold">Column Settings</h3>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-xs"
				onclick={() => (modalOpen = false)}
			>
				<IDismiss class="size-4" />
			</button>
		</div>

		<!-- Column name -->
		<div class="form-control mb-3 gap-1">
			<label class="label py-0"><span class="label-text text-xs">Column name</span></label>
			{#if chartMode === 'bar'}
				<input
					type="text"
					bind:value={barTable.headers[modalColIdx]}
					class="input-bordered input input-sm"
				/>
			{:else}
				<input
					type="text"
					bind:value={lineTable.headers[modalColIdx]}
					class="input-bordered input input-sm"
				/>
			{/if}
		</div>

		<!-- Data type -->
		<div class="form-control mb-3 gap-1">
			<label class="label py-0"><span class="label-text text-xs">Data type</span></label>
			<div class="join w-full">
				{#each COL_TYPE_CYCLE as t}
					<button
						type="button"
						class="btn join-item flex-1 btn-sm {modalColType === t ? 'btn-primary' : 'btn-outline'}"
						onclick={() => setModalColType(t)}
					>
						{t === 'date' ? '📅' : t === 'number' ? '#' : 'T'}&nbsp;{t}
					</button>
				{/each}
			</div>
		</div>

		<!-- Series color -->
		{#if modalColIdx > 0}
			<div class="form-control mb-3 gap-1">
				<label class="label py-0"><span class="label-text text-xs">Series color</span></label>
				<div class="flex items-center gap-3">
					<input
						type="color"
						value={modalColor}
						oninput={(e) => setModalColor((e.target as HTMLInputElement).value)}
						class="h-10 w-16 cursor-pointer rounded border"
					/>
					<span class="font-mono text-sm text-base-content/70">{modalColor}</span>
				</div>
			</div>
		{/if}

		<!-- Remove column -->
		{#if (chartMode === 'bar' ? barTable.headers : lineTable.headers).length > 2 && modalColIdx > 0}
			<button
				type="button"
				class="btn mb-3 w-full btn-outline btn-sm btn-error"
				onclick={() => {
					removeColumn(modalColIdx);
					modalOpen = false;
				}}
			>
				<IDismiss class="mr-1 size-4" /> Remove this column
			</button>
		{/if}

		<button type="button" class="btn w-full btn-sm btn-primary" onclick={() => (modalOpen = false)}>
			Done
		</button>
	</div>

	<!-- Click backdrop to close -->
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => (modalOpen = false)}>close</button>
	</form>
</dialog>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
	<!-- ── CONFIG PANEL ── -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body space-y-4 p-4">
			<h2 class="card-title gap-2 text-lg">
				<ITune class="size-5 text-primary" /> Configuration
			</h2>

			<div class="join w-full">
				<button
					type="button"
					class="btn join-item flex-1 btn-sm {chartMode === 'bar' ? 'btn-primary' : 'btn-outline'}"
					onclick={() => (chartMode = 'bar')}><IBarChart class="mr-1 inline size-4" /> Bar</button
				>
				<button
					type="button"
					class="btn join-item flex-1 btn-sm {chartMode === 'line' ? 'btn-primary' : 'btn-outline'}"
					onclick={() => (chartMode = 'line')}
					><ILineChart class="mr-1 inline size-4" /> Line</button
				>
			</div>

			<div class="form-control gap-1">
				<label class="label py-0"><span class="label-text text-xs">Orientation</span></label>
				<div class="join w-full">
					<button
						type="button"
						class="btn join-item flex-1 btn-sm {orientation === 'landscape'
							? 'btn-primary'
							: 'btn-outline'}"
						onclick={() => (orientation = 'landscape')}
						><ILandscape class="mr-1 inline size-4" /> Landscape</button
					>
					<button
						type="button"
						class="btn join-item flex-1 btn-sm {orientation === 'portrait'
							? 'btn-primary'
							: 'btn-outline'}"
						onclick={() => (orientation = 'portrait')}
						><IPortrait class="mr-1 inline size-4" /> Portrait</button
					>
				</div>
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

			<!-- ── AXIS LABELS TOGGLE -->
			<div class="form-control">
				<label class="label cursor-pointer py-1">
					<span class="label-text text-xs">Show Axis Labels</span>
					<input
						type="checkbox"
						bind:checked={showAxisLabels}
						class="toggle toggle-primary toggle-sm"
					/>
				</label>
			</div>

			{#if showAxisLabels}
				<div class="space-y-2 rounded-lg border border-base-300 bg-base-200/50 p-3">
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">X-axis label</span>
						</label>
						<input
							type="text"
							bind:value={xAxisLabel}
							placeholder="e.g. Equipment Type"
							class="input-bordered input input-xs"
						/>
					</div>
					<div class="form-control">
						<label class="label py-0.5">
							<span class="label-text text-xs">Y-axis label</span>
						</label>
						<input
							type="text"
							bind:value={yAxisLabel}
							placeholder="e.g. Count"
							class="input-bordered input input-xs"
						/>
					</div>
				</div>
			{/if}

			<div class="divider my-0"></div>

			<button
				type="button"
				class="btn w-full btn-sm btn-primary"
				onclick={exportAsImage}
				disabled={isExporting}
			>
				{#if isExporting}Exporting…{:else}<ICamera class="mr-1 inline size-4" /> Export PNG{/if}
			</button>
		</div>
	</div>

	<!-- ── CHART + TABLE PANEL ── -->
	<div class="flex flex-col gap-4 lg:col-span-2">
		<!-- Chart -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body items-center p-4">
				<div
					bind:this={chartElement}
					data-export-chart
					class="relative w-full rounded-lg bg-[#141214] p-4 pr-6 text-neutral-content ring-1 ring-white/10"
					style={figureStyle}
				>
					<Branding isMobile={false} />
					<div class="mb-6 text-center">
						<h3 class="text-md font-semibold md:text-base">{title}</h3>
						{#if subtitle?.trim()}
							<div class="mx-auto my-2 h-px w-48 bg-gray-600"></div>
							<p class="text-xs text-gray-400 md:text-sm">{subtitle}</p>
						{/if}
					</div>

					{#if chartMode === 'bar'}
						{#if barCategories.length > 0}
							<div class="relative">
								<!-- Y-axis label: rotated, positioned left of the chart -->
								{#if showAxisLabels && yAxisLabel?.trim()}
									<div
										class="pointer-events-none absolute inset-y-0 left-0 flex items-center"
										style="width:16px;"
									>
										<span
											class="whitespace-nowrap text-gray-400"
											style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; line-height:1;"
											>{yAxisLabel}</span
										>
									</div>
								{/if}
								<Plot
									height={Math.max(200, barCategories.length * 36 + 60)}
									marginLeft={showAxisLabels && yAxisLabel?.trim() ? 156 : 140}
									marginBottom={showAxisLabels && xAxisLabel?.trim() ? 50 : 30}
									marginRight={40}
									x={{ domain: [0, effectiveBarMax], grid: true }}
									y={{ domain: [...barCategories].reverse(), padding: 0.2 }}
									class="color-gray-400 font-size-12 bg-transparent"
								>
									<BarX data={barChartData} x="value" y="category" fill={colorFill} inset={1} />
									<Text
										data={barSegmentLabels}
										x="x"
										y="category"
										text="label"
										fill="rgba(255,255,255,0.9)"
										fontSize={10}
										fontWeight="600"
										textAnchor="middle"
										dy={1}
									/>
									<Text
										data={barTotalLabels}
										x="x"
										y="category"
										text="label"
										fill="#9ca3af"
										fontSize={11}
										fontWeight="700"
										textAnchor="start"
										dx={4}
										dy={1}
									/>
									<AxisX tickFormat={(d) => String(d)} style="color: #9ca3af; font-size: 11px;" />
									<AxisY style="color: #e5e7eb; font-size: 11px;" />
									<RuleX x={0} />
								</Plot>
								<!-- X-axis label below bar chart -->
								{#if showAxisLabels && xAxisLabel?.trim()}
									<div class="mt-1 text-center">
										<span class="text-gray-400" style="font-size: 10px;">{xAxisLabel}</span>
									</div>
								{/if}
							</div>
							<!-- end relative wrapper -->
						{:else}
							<p class="py-12 text-center text-sm text-base-content/40">No data to display</p>
						{/if}
						<div class="mt-4 flex flex-wrap justify-center gap-2 text-xs md:text-sm">
							{#each legendItems as item (item)}
								<div class="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
									<div class="size-2.5 rounded-full" style="background-color: {legendColors[item]}"></div>
									<span class="text-gray-200">{item}</span>
								</div>
							{/each}
						</div>
					{:else}
						{#if lineXDomain.length > 0}
							<div class="relative">
								<!-- Y-axis label rotated left -->
								{#if showAxisLabels && yAxisLabel?.trim()}
									<div
										class="pointer-events-none absolute inset-y-0 left-0 flex items-center"
										style="width:16px;"
									>
										<span
											class="whitespace-nowrap text-gray-400"
											style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; line-height:1;"
											>{yAxisLabel}</span
										>
									</div>
								{/if}
								<Plot
									height={lineHeight}
									marginLeft={showAxisLabels && yAxisLabel?.trim() ? 70 : 50}
									marginBottom={showAxisLabels && xAxisLabel?.trim() ? 65 : 50}
									marginRight={20}
									marginTop={10}
									x={{ domain: lineXDomain, grid: true, padding: 0.05 }}
									y={{ domain: [0, effectiveLineMax], grid: true }}
									class="color-gray-400 font-size-12 bg-transparent"
								>
									{#each lineSeriesData as series (series.key)}
										<Line data={series.points} x="x" y="y" stroke={series.color} strokeWidth={2} />
										<Dot data={series.points} x="x" y="y" fill={series.color} r={3} />
									{/each}
									<AxisX tickFormat={(d) => String(d)} style="color: #9ca3af; font-size: 11px;" />
									<AxisY ticks={6} style="color: #e5e7eb; font-size: 11px;" />
								</Plot>
								<!-- X-axis label below line chart -->
								{#if showAxisLabels && xAxisLabel?.trim()}
									<div class="mt-1 text-center">
										<span class="text-gray-400" style="font-size: 10px;">{xAxisLabel}</span>
									</div>
								{/if}
							</div>
							<!-- end relative wrapper -->
						{:else}
							<p class="py-12 text-center text-sm text-base-content/40">No data to display</p>
						{/if}
						<div class="mt-3 flex flex-wrap justify-center gap-2 text-xs md:text-sm">
							{#each lineSeriesData as s (s.key)}
								<div class="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1">
									<div class="h-0.5 w-4 rounded" style="background-color:{s.color}"></div>
									<div class="size-2 rounded-full" style="background-color:{s.color}"></div>
									<span class="text-gray-200">{s.key}</span>
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
					<h2 class="card-title gap-2 text-base">
						<ITable class="size-4 text-primary" /> Data Editor
					</h2>
					<div class="flex flex-wrap gap-1">
						<button type="button" class="btn btn-outline btn-xs" onclick={addRow}>+ Row</button>
						<button type="button" class="btn btn-outline btn-xs" onclick={addColumn}>+ Col</button>
						<button type="button" class="btn btn-outline btn-xs" onclick={pasteCSVFromClipboard}>
							<IClipboard class="mr-1 inline size-4" /> Paste CSV
						</button>
					</div>
				</div>

				{#if csvPasteError}
					<p class="mb-2 text-xs text-error">{csvPasteError}</p>
				{/if}

				{#if chartMode === 'bar'}
					<div class="overflow-x-auto rounded-lg border border-base-300">
						<table class="table w-full table-xs">
							<thead>
								<tr class="bg-base-200">
									{#each barTable.headers as _h, colIdx (colIdx)}
										<th class="p-0">
											<div class="flex items-center gap-0.5 px-1 pt-1 pb-0">
												<input
													type="text"
													bind:value={barTable.headers[colIdx]}
													class="input input-xs min-w-12 flex-1 input-ghost px-1 text-xs font-semibold focus:bg-base-100"
												/>
												<button
													type="button"
													class="btn shrink-0 px-0.5 text-base-content/30 btn-ghost btn-xs hover:text-primary"
													onclick={(e) => openColModal(e, colIdx)}
													title="Column settings"><ISettings class="size-3.5" /></button
												>
											</div>
										</th>
									{/each}
									<th class="w-6 p-0"></th>
								</tr>
							</thead>
							<tbody>
								{#each barTable.rows as row, rowIdx (row)}
									<tr class="group hover:bg-base-200/40">
										{#each row as _cell, colIdx (colIdx)}
											{@const colType = barTable.colTypes[colIdx] ?? 'text'}
											<td class="p-0">
												<input
													type={colType === 'number'
														? 'number'
														: colType === 'date'
															? 'date'
															: 'text'}
													bind:value={row[colIdx]}
													class="input input-xs w-full min-w-12 input-ghost px-2 text-xs focus:bg-base-100
														{colType === 'number' ? 'text-right tabular-nums' : ''}"
												/>
											</td>
										{/each}
										<td class="w-6 p-0">
											<button
												type="button"
												class="btn px-1 text-error opacity-0 btn-ghost btn-xs group-hover:opacity-100"
												onclick={() => removeRow(rowIdx)}
												title="Delete row"><IDismiss class="size-3.5" /></button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-lg border border-base-300">
						<table class="table w-full table-xs">
							<thead>
								<tr class="bg-base-200">
									{#each lineTable.headers as _h, colIdx (colIdx)}
										<th class="p-0">
											<div class="flex items-center gap-0.5 px-1 pt-1 pb-0">
												<input
													type="text"
													bind:value={lineTable.headers[colIdx]}
													class="input input-xs min-w-12 flex-1 input-ghost px-1 text-xs font-semibold focus:bg-base-100"
												/>
												<button
													type="button"
													class="btn shrink-0 px-0.5 text-base-content/30 btn-ghost btn-xs hover:text-primary"
													onclick={(e) => openColModal(e, colIdx)}
													title="Column settings"><ISettings class="size-3.5" /></button
												>
											</div>
										</th>
									{/each}
									<th class="w-6 p-0"></th>
								</tr>
							</thead>
							<tbody>
								{#each lineTable.rows as row, rowIdx (row)}
									<tr class="group hover:bg-base-200/40">
										{#each row as _cell, colIdx (colIdx)}
											{@const colType = lineTable.colTypes[colIdx] ?? 'text'}
											<td class="p-0">
												<input
													type={colType === 'number'
														? 'number'
														: colType === 'date'
															? 'date'
															: 'text'}
													bind:value={row[colIdx]}
													class="input input-xs w-full min-w-12 input-ghost px-2 text-xs focus:bg-base-100
														{colType === 'number' ? 'text-right tabular-nums' : ''}"
												/>
											</td>
										{/each}
										<td class="w-6 p-0">
											<button
												type="button"
												class="btn px-1 text-error opacity-0 btn-ghost btn-xs group-hover:opacity-100"
												onclick={() => removeRow(rowIdx)}
												title="Delete row"><IDismiss class="size-3.5" /></button
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div>
		<p class="mb-1 text-xs text-base-content/50">Examples</p>
		<div class="flex flex-wrap gap-1">
			{#if chartMode === 'bar'}
				<button type="button" class="btn btn-outline btn-xs" onclick={loadBarExample1}>Bar 1</button
				>
				<button type="button" class="btn btn-outline btn-xs" onclick={loadBarExample2}>Bar 2</button
				>
			{:else}
				<button type="button" class="btn btn-outline btn-xs" onclick={loadLineExample1}
					>Line 1</button
				>
				<button type="button" class="btn btn-outline btn-xs" onclick={loadLineExample2}
					>Line 2</button
				>
			{/if}
		</div>
	</div>
</div>
