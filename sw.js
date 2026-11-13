// Service worker: cho app mở được cả khi mất mạng (lấy bản đã lưu gần nhất)
const CACHE = 'chitieu-v2';
const PRE = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-180.png', './icon-192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(PRE.map(u => c.add(u)))));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.includes('script.google')) return; // API đồng bộ: không cache
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
