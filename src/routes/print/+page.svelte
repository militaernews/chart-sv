<!--
	Render-only version of the chart, driven entirely by the ?data= query
	param (base64 JSON) instead of local editable state. No editor UI - this
	page exists to be screenshotted by /api/render, not viewed by users.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Branding from '$lib/components/Branding.svelte';
	import { Plot, BarX, RuleX, AxisX, AxisY, Line, Dot, Text } from 'svelteplot';

	type ChartMode = 'bar' | 'line';

	type RenderConfig = {
		chartMode: ChartMode;
		title: string;
		subtitle?: string;
		maxScaleValue?: number;
		showAxisLabels?: boolean;
		xAxisLabel?: string;
		yAxisLabel?: string;
		table: { headers: string[]; rows: (string | number)[][] };
		colors?: Record<string, string>;
	};

	function decodeConfig(): RenderConfig | null {
		// URLSearchParams already percent-decodes the value, so this is plain JSON.
		const raw = page.url.searchParams.get('data');
		if (!raw) return null;
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}

	const config = decodeConfig();

	const chartMode = config?.chartMode ?? 'bar';
	const title = config?.title ?? '';
	const subtitle = config?.subtitle ?? '';
	const maxScaleValue = config?.maxScaleValue ?? 0;
	const showAxisLabels = config?.showAxisLabels ?? false;
	const xAxisLabel = config?.xAxisLabel ?? '';
	const yAxisLabel = config?.yAxisLabel ?? '';
	const headers = config?.table?.headers ?? [];
	const rows = config?.table?.rows ?? [];
	const colors = config?.colors ?? {};

	const defaultColors = ['#ff0000', '#ffaa00', '#ffdd00', '#44aaff', '#44ff88', '#cc44ff', '#666666'];
	const seriesKeys = headers.slice(1);
	const colorFor = (key: string, i: number) => colors[key] ?? defaultColors[i % defaultColors.length];

	// ── BAR ──────────────────────────────────────────────────────────────────
	const parsedBarData =
		chartMode === 'bar'
			? rows
					.filter((row) => String(row[0] ?? '').trim())
					.map((row) => {
						const obj: Record<string, any> = { Category: row[0] };
						seriesKeys.forEach((h, i) => (obj[h] = Number(row[i + 1]) || 0));
						return obj;
					})
			: [];

	const barChartData: { category: string; type: string; value: number }[] = [];
	for (const item of parsedBarData)
		for (const key of seriesKeys) if ((item[key] || 0) > 0) barChartData.push({ category: item.Category, type: key, value: item[key] });

	const barCategories = parsedBarData.map((d) => d.Category);
	const barMaxValue = Math.max(1, ...parsedBarData.flatMap((d) => seriesKeys.map((k) => d[k] || 0)), 1);
	const effectiveBarMax = maxScaleValue > 0 ? maxScaleValue : barMaxValue;

	const barSegmentLabels: { category: string; x: number; label: string }[] = [];
	for (const item of parsedBarData) {
		let offset = 0;
		for (const key of seriesKeys) {
			const v = item[key] || 0;
			if (v > 0) {
				barSegmentLabels.push({ category: item.Category, x: offset + v / 2, label: String(v) });
				offset += v;
			}
		}
	}
	const barTotalLabels = parsedBarData
		.map((item) => ({
			category: item.Category,
			x: seriesKeys.reduce((s, k) => s + (item[k] || 0), 0),
			label: String(seriesKeys.reduce((s, k) => s + (item[k] || 0), 0))
		}))
		.filter((d) => d.label !== '0');

	// ── LINE ─────────────────────────────────────────────────────────────────
	const lineSeriesData =
		chartMode === 'line'
			? seriesKeys.map((key, ki) => ({
					key,
					color: colorFor(key, ki),
					points: rows.map((row) => ({ x: row[0], y: Number(row[ki + 1] ?? 0) || 0 }))
				}))
			: [];
	const lineMaxY = Math.max(1, ...rows.flatMap((row) => seriesKeys.map((_, i) => Number(row[i + 1] ?? 0) || 0)), 1);
	const effectiveLineMax = maxScaleValue > 0 ? maxScaleValue : lineMaxY;
	const lineXDomain = rows.map((r) => r[0]);
</script>

{#if !config}
	<p style="color:red">Missing or invalid ?data=</p>
{:else}
	<div id="chart-root" class="relative inline-block bg-[#1a1a1a] p-4 pr-6 text-neutral-content">
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
					{#if showAxisLabels && yAxisLabel?.trim()}
						<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center" style="width:16px;">
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
						<BarX
							data={barChartData}
							x="value"
							y="category"
							fill={(d: { type: string }) => colorFor(d.type, seriesKeys.indexOf(d.type))}
							inset={1}
						/>
						<Text data={barSegmentLabels} x="x" y="category" text="label" fill="rgba(255,255,255,0.9)" fontSize={10} fontWeight="600" textAnchor="middle" dy={1} />
						<Text data={barTotalLabels} x="x" y="category" text="label" fill="#9ca3af" fontSize={11} fontWeight="700" textAnchor="start" dx={4} dy={1} />
						<AxisX tickFormat={(d) => String(d)} style="color: #9ca3af; font-size: 11px;" />
						<AxisY style="color: #e5e7eb; font-size: 11px;" />
						<RuleX x={0} />
					</Plot>
					{#if showAxisLabels && xAxisLabel?.trim()}
						<div class="mt-1 text-center"><span class="text-gray-400" style="font-size: 10px;">{xAxisLabel}</span></div>
					{/if}
				</div>
			{/if}
			<div class="mt-4 flex flex-wrap justify-center gap-6 text-xs md:text-sm">
				{#each seriesKeys as item, i (item)}
					<div class="flex items-center gap-2">
						<div class="size-4 rounded" style="background-color: {colorFor(item, i)}"></div>
						<span>{item}</span>
					</div>
				{/each}
			</div>
		{:else if lineXDomain.length > 0}
			<div class="relative">
				{#if showAxisLabels && yAxisLabel?.trim()}
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center" style="width:16px;">
						<span
							class="whitespace-nowrap text-gray-400"
							style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 10px; line-height:1;"
							>{yAxisLabel}</span
						>
					</div>
				{/if}
				<Plot
					height={300}
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
				{#if showAxisLabels && xAxisLabel?.trim()}
					<div class="mt-1 text-center"><span class="text-gray-400" style="font-size: 10px;">{xAxisLabel}</span></div>
				{/if}
			</div>
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
{/if}
