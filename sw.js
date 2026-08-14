/* 大模型学习打卡助手 · 新版 · Service Worker
 * 策略：导航请求「网络优先，失败回退缓存」；其余静态资源「缓存优先，失败回退网络」。
 * 注意：CACHE 使用 v53 命名，与旧版（llm-checkin-v51/v52）完全隔离，互不干扰。
 */
const CACHE = 'llm-checkin-v53-4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // 不拦截 POST（如 AI API 调用）

  const url = new URL(req.url);
  // 跨域请求（如外部 AI 接口）直接走网络，不缓存
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // 导航请求：网络优先，失败回退缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // 其他同源静态资源：缓存优先，失败回退网络
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
