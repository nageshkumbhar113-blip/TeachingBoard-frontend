const SW_VERSION = 'v144';
const CACHE_PREFIX = 'nkseduorbit';
const LEGACY_CACHE_PREFIX = 'teachingboard';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${SW_VERSION}`;
const OFFLINE_STUDENT_URL = './student-app/index.html';
const OFFLINE_ADMIN_URL = './admin-app/admin.html';

const CORE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './sw.js',
  './env.js',
  './icons/icon-72.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/style.css',
  './css/design-tokens.css',
  './js/splash.js',
  './icons/nk-logo.png',
  './core/db.js',
  './core/helpers.js',
  './core/fileExport.js',
  './core/math.js',
  './core/i18n.js',
  './core/pdf.js',
  './core/sync.js',
  './core/paperPdf.js',
  './core/crypto.js',
  './student-app/index.html',
  './student-app/app.js',
  './student-app/payment.js',
  './student-app/quiz.js',
  './student-app/testPlayer.js',
  './student-app/ui.js',
  './student-app/analytics.js',
  './student-app/deepStudy.js',
  './student-app/tts.js',
  './student-app/teacherDashboard.js',
  './student-app/teacherPaperBuilder.js',
  './student-app/parentDashboard.js',
  './student-app/student-mobile.js',
  './student-app/dictionary.js',
  './student-app/vocabPlayer.js',
  './student-app/wordTestPlayer.js',
  './student-app/wordTestInsights.js',
  './student-app/notesViewer.js',
  './student-app/homeSearch.js',
  './student-app/exerciseViewer.js',
  './student-app/student-ui.css',
  './student-app/notesViewer.css',
  './student-app/manifest.json',
  './admin-app/admin.html',
  './admin-app/admin.js',
  './admin-app/admin-shell.js',
  './admin-app/admin-mobile.js',
  './admin-app/testBuilder.js',
  './admin-app/wordTestBuilder.js',
  './admin-app/notesManager.js',
  './admin-app/conceptManager.js',
  './admin-app/exerciseManager.js',
  './admin-app/paperBuilder.js',
  './admin-app/batchPricingManager.js',
  './admin-app/parser.js',
  './admin-app/admin-ui.css',
  './admin-app/concept-manager.css',
  './admin-app/paper-builder.css',
  './admin-app/batch-pricing.css',
  './admin-app/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(CORE_ASSETS.map(asset => cache.add(asset).catch(() => null)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => (key.startsWith(`${CACHE_PREFIX}-`) || key.startsWith(`${LEGACY_CACHE_PREFIX}-`)) && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
      await _notifyClients({ type: 'SW_UPDATED', version: SW_VERSION });
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  if (_isNavigationRequest(request)) {
    event.respondWith(_handleNavigationRequest(request));
    return;
  }

  if (_isStaticAsset(request)) {
    event.respondWith(_handleStaticAssetRequest(request));
    return;
  }

  event.respondWith(_handleRuntimeRequest(request));
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-questions') {
    event.waitUntil(_notifySyncReady());
  }
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function _handleNavigationRequest(request) {
  try {
    const fresh = await fetch(request);
    await _cacheResponse(RUNTIME_CACHE, request, fresh);
    return fresh;
  } catch {
    const cached = await _matchFromKnownCaches(request);
    if (cached) return cached;

    const fallback = await _matchFromKnownCaches(_getOfflineFallback(request.url));
    if (fallback) return fallback;

    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function _handleStaticAssetRequest(request) {
  const cached = await _matchFromKnownCaches(request);
  const fetchPromise = fetch(request)
    .then(async response => {
      await _cacheResponse(STATIC_CACHE, request, response);
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await fetchPromise;
  if (fresh) return fresh;

  return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
}

async function _handleRuntimeRequest(request) {
  const cached = await _matchFromKnownCaches(request);
  if (cached) return cached;

  try {
    const fresh = await fetch(request);
    await _cacheResponse(RUNTIME_CACHE, request, fresh);
    return fresh;
  } catch {
    if (request.destination === 'document') {
      const fallback = await _matchFromKnownCaches(_getOfflineFallback(request.url));
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'Offline resource unavailable' });
  }
}

function _getOfflineFallback(requestUrl) {
  const url = new URL(requestUrl);
  return url.pathname.includes('/admin-app/') || url.pathname.endsWith('/admin.html')
    ? OFFLINE_ADMIN_URL
    : OFFLINE_STUDENT_URL;
}

async function _cacheResponse(cacheName, request, response) {
  if (!response || response.status !== 200) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function _matchFromKnownCaches(request) {
  for (const cacheName of [STATIC_CACHE, RUNTIME_CACHE]) {
    const cache = await caches.open(cacheName);
    const match = await cache.match(request);
    if (match) return match;
  }
  return caches.match(request);
}

function _isNavigationRequest(request) {
  return request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html');
}

function _isStaticAsset(request) {
  return ['style', 'script', 'worker', 'image', 'font', 'manifest'].includes(request.destination);
}

async function _notifySyncReady() {
  await _notifyClients({ type: 'SYNC_READY' });
}

async function _notifyClients(payload) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage(payload));
}
