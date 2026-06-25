// RECOVR Service Worker - 오프라인 캐싱
const CACHE_NAME = 'recovr-cache-v25';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './userProfile.js',
  './durationTimer.js',
  './cardioTracker.js',
  './backupStorage.js',
  './backupWriter.js',
  './recommendation.js',
  './workoutAdvice.js',
  './aiCoach.js',
  './dailyMission.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

const NETWORK_FIRST_PATHS = [
  '/index.html',
  '/app.js',
  '/durationTimer.js',
  '/cardioTracker.js',
  '/userProfile.js',
  '/backupStorage.js',
  '/backupWriter.js',
  '/recommendation.js',
  '/workoutAdvice.js',
  '/aiCoach.js',
  '/dailyMission.js',
  '/sw.js',
];

function isNetworkFirstRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return NETWORK_FIRST_PATHS.some((p) => path.endsWith(p) || path === p || path.endsWith(p.slice(1)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isNetworkFirstRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
