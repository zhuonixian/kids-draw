// === 画画乐园 Service Worker：离线缓存应用壳 ===
// 版本号递增即可触发旧缓存清理
const CACHE = 'kids-draw-v2';
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
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    // HTML/JS/CSS 走 network-first：代码更新后用户立即可见，离线时回退缓存
    const isAppShell = url.pathname.endsWith('.html')
        || url.pathname.endsWith('.js')
        || url.pathname.endsWith('.css')
        || url.pathname === '/' ;

    e.respondWith(
        (isAppShell
            ? fetch(e.request).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            }).catch(() => caches.match(e.request))
            : caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            }))
        ).then(resp => resp || caches.match('./index.html'))
    );
});
