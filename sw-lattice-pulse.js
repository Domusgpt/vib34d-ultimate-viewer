const CACHE_NAME = 'lattice-pulse-v2';
const PRECACHE = [
  './lattice-pulse.html',
  './styles/lattice-pulse.css',
  './src/game/LatticePulseGame.js',
  './src/game/GameLoop.js',
  './src/game/AudioService.js',
  './src/game/ModeController.js',
  './src/game/GeometryController.js',
  './src/game/SpawnSystem.js',
  './src/game/CollisionSystem.js',
  './src/game/InputMapping.js',
  './src/game/EffectsManager.js',
  './src/game/PerformanceController.js',
  './src/game/LevelManager.js',
  './src/game/GameState.js',
  './src/game/RogueLiteDirector.js',
  './src/game/utils/Random.js',
  './src/game/utils/Math4D.js',
  './src/game/persistence/LocalPersistence.js',
  './src/game/ui/HUDRenderer.js',
  './src/game/levels/rogue-lite-endless.json',
  './src/game/levels/lvl-01-faceted-torus.json',
  './src/game/levels/lvl-02-quantum-sphere.json',
  './src/game/levels/lvl-03-holographic-crystal.json',
  './icons/lattice-192.svg',
  './icons/lattice-512.svg',
  './lattice-pulse-manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) {
        return caches.delete(key);
      }
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
