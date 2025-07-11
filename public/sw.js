const CACHE_NAME = 'adapt-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/src/index.tsx',
  '/src/index.css',
  // Note: We don't cache the CDN scripts as they are cross-origin and complex to manage.
  // The app will rely on a network connection for the first load to get these.
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

self.addEventListener('fetch', (event) => {
  const { url } = event.request;

  // Strategy for API calls: Network first, then cache
  if (url.includes(API_URL_PATTERN)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If the network request is successful, clone it, cache it, and return it
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If the network fails, try to get the response from the cache
          console.log(`Service Worker: Network failed for ${url}. Serving from cache.`);
          return caches.match(event.request);
        })
    );
  } 
  // Strategy for App Shell & other assets: Cache first
  else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // If we have a match in the cache, return it
        if (response) {
          return response;
        }
        // Otherwise, fetch from the network
        return fetch(event.request).catch(error => {
            console.log(`Service Worker: Fetch failed for ${url}; returning offline fallback if available.`);
            // Optionally, return a generic offline page/response here
        });
      })
    );
  }
});
