// Offline play (design: PWA). Install caches the page and everything it links;
// hashed assets are cache-first, the page itself network-first with a cached fallback.
const CACHE = 'drew-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      const html = await (await fetch('./', { cache: 'reload' })).text();
      const urls = new Set(['./', 'manifest.webmanifest', 'icons/icon-192.png', 'fonts/gochi-hand.woff2', 'fonts/patrick-hand.woff2']);
      for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!m[1].startsWith('http')) urls.add(m[1]);
      // absolute and de-duplicated: addAll rejects the whole batch on a repeated URL
      await c.addAll([...new Set([...urls].map((u) => new URL(u, self.registration.scope).href))]);
      self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return r;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        }),
    ),
  );
});
