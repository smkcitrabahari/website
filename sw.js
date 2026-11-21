const CACHE_NAME = 'portal-publik-sekolah-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './redaksi.html',
    './style.css',
    './config.js',
    './app.js',
    './redaksi.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Selalu ambil data terbaru untuk request API & Storage Supabase
    if (event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
