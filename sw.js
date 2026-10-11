// === 画画乐园 Service Worker：离线缓存应用壳 ===
// 版本号递增即可触发旧缓存清理
const CACHE = 'kids-draw-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/shapes.js',
    './js/app.js',
    './js/store.js',
    './js/stickers.js',
    './js/tracing.js',
    './js/freecanvas.js',
    './js/gallery.js',
    './js/parent.js',
    './assets/fonts/zcool-kuaile-subset.woff2',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
            // 同源成功响应回填缓存（覆盖首次未预热的资源）
            if (resp.ok && new URL(e.request.url).origin === self.location.origin) {
                const clone = resp.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return resp;
        }).catch(() => caches.match('./index.html')))
    );
});
