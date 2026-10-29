// Service worker: app shell cache-first, lesson content network-first (so new lessons arrive without a version bump).
// Bump VERSION whenever index.html / app.js / style.css / icons change.
const VERSION = 'v1.8.0';
const CACHE = 'panda-talk-' + VERSION;
const AUDIO = 'panda-audio';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.webmanifest',
  './content/units.json',
  './content/charpy.json',
  './audio/index.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' bypasses the browser HTTP cache (GitHub Pages sends max-age=600),
  // otherwise a new version could be installed with the previous version's files.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 'panda-audio' (recorded words) is not versioned, so updates never throw the downloaded sound away.
    for (const k of await caches.keys()) if (k !== CACHE && k !== AUDIO) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  const isContent = path.includes('/content/') || path.endsWith('/audio/index.json');
  if (path.includes('/audio/') && path.endsWith('.mp3')) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isContent) {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    }
    const hit = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
