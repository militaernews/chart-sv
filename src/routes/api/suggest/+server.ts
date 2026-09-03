import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Proxies our backend's post feed so the bearer token stays server-side and
 * never reaches the browser. Configure SUGGEST_API_URL/SUGGEST_API_KEY to
 * point at that backend's feed endpoint.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const SUGGEST_API_URL = env.SUGGEST_API_URL;
	const SUGGEST_API_KEY = env.SUGGEST_API_KEY;

	if (!SUGGEST_API_URL || !SUGGEST_API_KEY) {
		return json({ error: 'suggest feed not configured' }, { status: 503 });
	}

	const limit = url.searchParams.get('limit') ?? '200';
	const upstream = await fetch(`${SUGGEST_API_URL}?limit=${encodeURIComponent(limit)}`, {
		headers: { Authorization: `Bearer ${SUGGEST_API_KEY}` }
	});

	if (!upstream.ok) {
		return json({ error: `suggest feed error (${upstream.status})` }, { status: 502 });
	}

	return json(await upstream.json());
};
