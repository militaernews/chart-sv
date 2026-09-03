import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

/**
 * POST a chart config, get a rendered PNG back.
 *
 * Body (all fields but chartMode/table optional):
 *   {
 *     chartMode: 'bar' | 'line',
 *     title: string,
 *     subtitle?: string,
 *     maxScaleValue?: number,
 *     showAxisLabels?: boolean,
 *     xAxisLabel?: string,
 *     yAxisLabel?: string,
 *     table: { headers: string[], rows: (string|number)[][] },
 *     colors?: Record<string, string>
 *   }
 *
 * Renders the same chart the interactive editor shows by loading /print
 * with the config in the query string and screenshotting it headlessly -
 * reuses the real chart component instead of re-implementing chart drawing
 * server-side.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	let config: Record<string, unknown>;
	try {
		config = await request.json();
	} catch {
		throw error(400, 'Body must be valid JSON');
	}

	if (config?.chartMode !== 'bar' && config?.chartMode !== 'line') {
		throw error(400, 'chartMode must be "bar" or "line"');
	}
	if (!config?.table || typeof config.table !== 'object') {
		throw error(400, 'table (with headers + rows) is required');
	}

	const printUrl = `${url.origin}/print?data=${encodeURIComponent(JSON.stringify(config))}`;

	const browser = await puppeteer.launch({
		args: chromium.args,
		executablePath: await chromium.executablePath(),
		headless: true
	});

	try {
		const page = await browser.newPage();
		await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });
		await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 20000 });

		const root = await page.waitForSelector('#chart-root', { timeout: 10000 });
		if (!root) throw error(500, 'Chart did not render');

		const png = await root.screenshot({ type: 'png' });

		return new Response(png as Buffer, {
			headers: { 'Content-Type': 'image/png' }
		});
	} finally {
		await browser.close();
	}
};
