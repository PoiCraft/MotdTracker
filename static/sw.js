/**
 * MotdTracker Service Worker
 * 提供离线支持和资源缓存
 */

const CACHE_VERSION = 'v1.5.0';
const CACHE_NAME = `motdtracker-${CACHE_VERSION}`;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟检查一次版本

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  '/static/css/style.css',
  '/static/css/variables.css',
  '/static/css/layout.css',
  '/static/css/components.css',
  '/static/css/charts.css',
  '/static/css/heatmap.css',
  '/static/css/players.css',
  '/static/css/pages.css',
  '/static/css/modals.css',
  '/static/css/responsive.css',
  '/static/css/spinners.css',
  '/static/js/chart.min.js',
  '/static/js/socket.io.min.js',
  '/static/poi.png',
  '/static/manifest.json'
];

// 需要缓存的页面
const CACHED_PAGES = [
  '/server',
  '/nodes',
  '/players',
  '/badges'
];

// 不应该缓存的路径（API 和实时数据）
const NO_CACHE_PATTERNS = [
  /^\/api\//,
  /^\/socket\.io/,
  /\/api\/socket\.io/
];

/**
 * 安装事件 - 预缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('motdtracker-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

/**
 * 检查是否应该跳过缓存
 */
function shouldSkipCache(url) {
  const pathname = new URL(url).pathname;
  return NO_CACHE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * 检查是否是页面请求
 */
function isPageRequest(request) {
  const url = new URL(request.url);
  return request.mode === 'navigate' || 
         CACHED_PAGES.includes(url.pathname) ||
         url.pathname === '/';
}

/**
 * 检查是否是静态资源
 */
function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return pathname.startsWith('/static/');
}

/**
 * Fetch 事件 - 处理请求策略
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;
  
  // 跳过非 GET 请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 跳过 API 和 WebSocket 请求
  if (shouldSkipCache(url)) {
    return;
  }
  
  // 静态资源: Cache First 策略
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, responseClone));
              }
              return networkResponse;
            });
        })
    );
    return;
  }
  
  // 页面请求: Network First 策略（离线时使用缓存）
  if (isPageRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 返回离线页面（如果有的话）
              return caches.match('/server');
            });
        })
    );
    return;
  }
});

/**
 * 消息事件 - 处理来自页面的消息
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    checkForUpdates();
  }
});

/**
 * 检查服务端版本更新
 */
async function checkForUpdates() {
  try {
    const response = await fetch('/api/exporter/version', { cache: 'no-store' });
    if (!response.ok) return;
    
    const data = await response.json();
    const serverVersion = data.cache_version;
    
    if (serverVersion && serverVersion !== CACHE_VERSION) {
      console.log(`[SW] New version available: ${serverVersion} (current: ${CACHE_VERSION})`);
      
      // 通知所有客户端有新版本
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          currentVersion: CACHE_VERSION,
          newVersion: serverVersion
        });
      });
    }
  } catch (error) {
    console.log('[SW] Version check failed:', error.message);
  }
}

/**
 * 后台同步（可选，用于离线时记录操作）
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});

console.log('[SW] Service Worker loaded');
