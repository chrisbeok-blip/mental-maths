// Network-first: when online every same-origin file is fetched fresh (revalidated against the
// server, bypassing the browser's HTTP cache) and stored; the stored copy is only used offline.
// The cache name is for cleanup, not versioning: no bump is needed on deploy.
const CACHE = 'mental-maths-store';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/ui.js', './src/rng.js', './src/num.js', './src/answer.js', './src/ladder.js', './src/version.js',
  './src/scheduler.js', './src/stats.js', './src/store.js', './src/session.js',
  './src/generators/index.js', './src/generators/tables.js', './src/generators/multiples.js',
  './src/generators/division.js', './src/generators/fractions.js', './src/generators/percent.js',
  './src/screens/home.js', './src/screens/method.js', './src/screens/drill.js', './src/screens/summary.js', './src/screens/progress.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // never touch cross-origin requests
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // A navigate-mode Request cannot be re-issued with options, so fetch by URL in that case.
      const fresh = e.request.mode === 'navigate'
        ? await fetch(e.request.url, { cache: 'no-cache' })
        : await fetch(e.request, { cache: 'no-cache' });
      if (fresh.ok) cache.put(e.request.mode === 'navigate' ? './index.html' : e.request, fresh.clone());
      return fresh;
    } catch {
      const hit = await cache.match(e.request.mode === 'navigate' ? './index.html' : e.request, { ignoreSearch: true });
      return hit || Response.error();
    }
  })());
});
