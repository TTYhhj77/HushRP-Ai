const HUSH_CACHE = 'hushrp-shell-v1.2.0';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/css/styles.css',
  '/locales/th.js',
  '/locales/en.js',
  '/locales/zh.js',
  '/locales/ja.js',
  '/js/i18n.js',
  '/js/state.js',
  '/js/mobile-runtime.js',
  '/js/api.js',
  '/js/characters.js',
  '/js/chat.js',
  '/js/settings.js',
  '/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(HUSH_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== HUSH_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Stale-while-revalidate for fast UI startup with background freshness
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(HUSH_CACHE).then(cache => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
