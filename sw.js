const CACHE_NAME = 'eugene-card-v1';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/revenue.html',
  '/analytics.html',
  '/manifest.json'
];

// Install Event - Pre-cache critical core app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Smart Caching Strategy
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. ALWAYS BYPASS CACHE for Firebase DB, Auth, and Analytics APIs
  if (
    requestUrl.hostname.includes('firestore.googleapis.com') ||
    requestUrl.hostname.includes('firebase.googleapis.com') ||
    requestUrl.hostname.includes('identitytoolkit.googleapis.com') ||
    requestUrl.hostname.includes('google-analytics.com')
  ) {
    return; // Let standard network handles Firestore realtime connections
  }

  // 2. Network-First Strategy for HTML Navigation Pages (Ensures latest updates)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Cache-First Strategy for CDNs (Tailwind, FontAwesome, Firebase SDK scripts) and local assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache valid HTTP responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});