// Service Worker for caching static assets
const CACHE_NAME = 'yokebud-crafts-v1';
const STATIC_CACHE = 'yokebud-static-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/logo.jpg',
  '/robots.txt',
  '/sitemap.xml',
  // Add other critical assets
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and same-origin requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip certain file types that shouldn't be cached or cause issues
  const url = new URL(event.request.url);
  if (url.pathname.includes('/api/') ||
      url.pathname.includes('.mp4') ||
      url.pathname.includes('.webm') ||
      url.pathname.includes('.mov') ||
      url.pathname.includes('hot-update') ||
      url.pathname.includes('sockjs-node')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses or partial responses
          if (!response.ok || response.status === 206 || response.status === 304) {
            return response;
          }

          // Only cache small, static assets
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > 1024 * 1024) { // Skip files > 1MB
            return response;
          }

          // Clone the response
          const responseClone = response.clone();

          // Cache successful responses (only status 200) asynchronously
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          }).catch(() => {
            // Silently fail if caching fails
          });

          return response;
        });
      })
      .catch(() => {
        // Return offline fallback if available
        return caches.match('/');
      })
  );
});