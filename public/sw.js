// Ludus offline support. Pages are fetched network-first (so a new deploy shows
// up straight away when online) and fall back to the cached copy offline.
// Build assets have hashed names, so they are served cache-first.

const CACHE = 'ludus-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './apple-touch-icon.png'];

/** Asset URLs referenced by an index.html (scripts, styles, preloads). */
function assetsIn(html, base) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = new URL(m[1], base);
    if (u.origin === self.location.origin && u.pathname.includes('/assets/')) urls.add(u.href);
  }
  return [...urls];
}

/** Cache the page and everything it needs; drop assets from older builds. */
async function cacheBuild(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const base = new URL('./', self.registration.scope).href;
  await cache.put(new URL('./', base).href, response.clone());
  await cache.put(new URL('./index.html', base).href, response.clone());
  const wanted = assetsIn(html, base);
  const fetchInto = async (u) => {
    let r = await cache.match(u);
    if (!r) {
      r = await fetch(u);
      if (!r.ok) return null;
      await cache.put(u, r.clone());
    }
    return r;
  };
  await Promise.all(
    wanted.map(async (u) => {
      const r = await fetchInto(u);
      // Stylesheets pull in the bundled fonts; cache those too.
      if (r && u.endsWith('.css')) {
        const css = await r.text();
        for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          if (m[1].startsWith('data:')) continue;
          const f = new URL(m[1], u).href;
          if (!wanted.includes(f)) wanted.push(f);
        }
      }
    }),
  );
  await Promise.all(wanted.filter((u) => /\.woff2$/.test(u)).map((u) => fetchInto(u).catch(() => null)));
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (u.pathname.includes('/assets/') && !wanted.includes(u.href)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      const r = await fetch('./index.html', { cache: 'no-cache' });
      if (r.ok) await cacheBuild(r);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const r = await fetch(req, { cache: 'no-cache' });
          if (r.ok) event.waitUntil(cacheBuild(r.clone()));
          return r;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match('./index.html', { ignoreSearch: true })) || (await cache.match('./')) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok && (url.pathname.includes('/assets/') || SHELL.some((s) => url.href === new URL(s, self.registration.scope).href))) {
        event.waitUntil(cache.put(req, r.clone()));
      }
      return r;
    })(),
  );
});
