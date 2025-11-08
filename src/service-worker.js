const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const IMAGE_CACHE_NAME = 'image-cache-v1';
const MAX_IMAGE_CACHE_SIZE = 50; // Maximum number of images to cache

// Image caching utilities
async function cleanupImageCache() {
	try {
		const cache = await caches.open(IMAGE_CACHE_NAME);
		const keys = await cache.keys();

		if (keys.length > MAX_IMAGE_CACHE_SIZE) {
			// Remove oldest entries (first in, first out)
			const toDelete = keys.slice(0, keys.length - MAX_IMAGE_CACHE_SIZE);
			await Promise.all(toDelete.map((key) => cache.delete(key)));
		}
	} catch (error) {
		console.error('Cache cleanup failed:', error);
	}
}

// Intercept fetch requests for images
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Cache images from Backblaze or image endpoints
	if (
		event.request.destination === 'image' ||
		url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i) ||
		url.hostname.includes('backblazeb2.com') ||
		url.hostname.includes('b2-api.com')
	) {
		event.respondWith(
			caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
				try {
					// Try cache first
					const cached = await cache.match(event.request);
					if (cached) {
						// Return cached version immediately
						return cached;
					}

					// Fetch from network
					const response = await fetch(event.request);

					// Only cache successful responses
					if (response.ok) {
						// Clone the response before caching
						cache.put(event.request, response.clone());

						// Cleanup old entries
						cleanupImageCache();
					}

					return response;
				} catch (error) {
					// If network fails, try to return cached version
					const cached = await cache.match(event.request);
					if (cached) {
						return cached;
					}
					throw error;
				}
			})
		);
		return;
	}
});

// Clean up old caches on activation
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					// Keep current image cache, delete old versions
					if (cacheName.startsWith('image-cache-') && cacheName !== IMAGE_CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
});

// Start the checker when service worker starts
startNotificationChecker();
