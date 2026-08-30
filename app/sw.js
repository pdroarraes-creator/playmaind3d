// PlayMind 3d - guarda la app para que abra sin internet
const CACHE = 'playmind3d-v17';
const ARCHIVOS = [
  './', './index.html', './app.css', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png',
  '/assets/logo-app.png', '/assets/logo-app-full.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // los datos del servidor nunca se cachean
  if (url.hostname.indexOf('script.google') === 0 || url.href.indexOf('script.google') > -1) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.status === 200 && url.origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
