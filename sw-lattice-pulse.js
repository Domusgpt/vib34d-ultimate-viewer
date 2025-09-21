const CACHE_NAME = 'lattice-pulse-v1';
const ASSETS = [
  './lattice-pulse.html',
  './styles/lattice-pulse.css',
  './js/lattice-pulse.js',
  './lattice-pulse.webmanifest',
  './assets/icons/lattice-pulse-icon.svg',
  './src/game/LatticePulseGame.js',
  './src/game/GameLoop.js',
  './src/game/audio/AudioService.js',
  './src/game/modes/ModeController.js',
  './src/game/modes/ModeRenderer.js',
  './src/game/geometry/GeometryController.js',
  './src/game/spawn/SpawnSystem.js',
  './src/game/collision/CollisionSystem.js',
  './src/game/input/InputMapping.js',
  './src/game/effects/EffectsManager.js',
  './src/game/performance/PerformanceController.js',
  './src/game/state/LevelManager.js',
  './src/game/state/defaultLevels.js',
  './src/game/ui/HudController.js',
  './src/game/utils/SeededRandom.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match('./lattice-pulse.html'));
    })
  );
});
