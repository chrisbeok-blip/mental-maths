// Precache everything; serve cache-first; navigations fall back to index.html.
// Bump CACHE on every deploy that changes any asset.
const CACHE = 'mental-maths-v4';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/ui.js', './src/rng.js', './src/num.js', './src/answer.js', './src/ladder.js',
  './src/scheduler.js', './src/stats.js', './src/store.js', './src/session.js',
  './src/generators/index.js', './src/generators/tables.js', './src/generators/multiples.js',
  './src/generators/division.js', './src/generators/fractions.js', './src/generators/percent.js',
  './src/screens/home.js', './src/screens/method.js', './src/screens/drill.js', './src/screens/summary.js', './src/screens/progress.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return; // never touch cross-origin requests
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
