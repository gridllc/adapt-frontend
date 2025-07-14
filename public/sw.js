const CACHE_NAME = 'adapt-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  // Dynamic assets like JS/CSS are handled by the fetch handler
];

// URLs for API calls that we want to cache with a network-first strategy
const API_URL_PATTERN = '/rest/v1/modules';

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching app shell');
      return cache.addAll(APP_SHELL_URLS);
    }).catch(error => {
      console.error('Failed to cache app shell:', error);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// A more robust fetch handler for an SPA
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests for caching. Let the browser handle them.
  if (request.method !== 'GET') {
    return;
  }

  // Strategy for API calls: Network first, then cache for successful responses.
  if (request.url.includes(API_URL_PATTERN)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Check if we received a valid response
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If the network fails, try to get the response from the cache.
          console.log(`Service Worker: Network failed for ${request.url}. Serving from cache.`);
          return caches.match(request);
        })
    );
    return;
  }

  // Strategy for all other requests (App Shell, assets, and navigation)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // If we have a cache hit, return it.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If it's not in the cache, try fetching from the network.
      return fetch(request)
        .then((networkResponse) => {
          // We only cache 'basic' type requests to avoid caching opaque responses from third-party CDNs.
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // This catch block is crucial for offline SPA functionality.
          // If the network fetch for a navigation request fails, serve the main index.html file.
          if (request.mode === 'navigate') {
            console.log('Service Worker: Fetch failed for navigation. Returning app shell.');
            return caches.match('/index.html');
          }
          // For other failed requests (like images, etc.), we don't have a fallback, so let the error propagate.
        });
    })
  );
});