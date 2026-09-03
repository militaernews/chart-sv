import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Proxies ptb-suggest's /api/posts data feed (militaernews suggest-queue
 * posts) so the bearer token configured in NEWSMIX_API_KEY never reaches
 * the browser. Point NEWSMIX_API_URL at the ptb-suggest host, e.g.
 * http://<nyx-host>:8080/api/posts.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const NEWSMIX_API_URL = env.NEWSMIX_API_URL;
	const NEWSMIX_API_KEY = env.NEWSMIX_API_KEY;

	if (!NEWSMIX_API_URL || !NEWSMIX_API_KEY) {
		return json({ error: 'newsmix API not configured' }, { status: 503 });
	}

	const limit = url.searchParams.get('limit') ?? '200';
	const upstream = await fetch(`${NEWSMIX_API_URL}?limit=${encodeURIComponent(limit)}`, {
		headers: { Authorization: `Bearer ${NEWSMIX_API_KEY}` }
	});

	if (!upstream.ok) {
		return json({ error: `newsmix API error (${upstream.status})` }, { status: 502 });
	}

	return json(await upstream.json());
};
