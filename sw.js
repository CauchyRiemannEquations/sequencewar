// 시퀀스 워 서비스 워커 — 설치형 웹앱 + 오프라인 실행.
// 배포 시 자산이 바뀌면 CACHE_NAME 버전을 올려야 이전 캐시가 교체된다.
const CACHE_NAME = 'sequence-war-v1';

const PRECACHE_ASSETS = [
    './',
    'index.html',
    'styles.css',
    'game.js',
    'orbitron.woff2',
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    'background.jpg',
    'commander.png',
    'soldier.png',
    'player-bullet.png',
    'boss-laser.png',
    'boss-stage-1.png',
    'boss-stage-2.png',
    'boss-stage-3.png',
    'boss-stage-4.png',
    'boss-stage-5.png',
    'boss-stage-6.png',
    'boss-stage-7.png',
    'boss-stage-8.png',
    'boss-stage-9.png',
    'boss-stage-10.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

    const isCode = request.mode === 'navigate'
        || request.destination === 'script'
        || request.destination === 'style';

    if (isCode) {
        // 코드/문서는 네트워크 우선 — 새 배포가 바로 반영되고, 오프라인이면 캐시로
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request, { ignoreSearch: true }))
        );
    } else {
        // 이미지/폰트는 캐시 우선 — 변하지 않는 자산이라 즉시 로드
        event.respondWith(
            caches.match(request).then(cached =>
                cached || fetch(request).then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
            )
        );
    }
});
