/**
 * Service Worker - 离线缓存支持
 */

const CACHE_NAME = 'charging-app-v12';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/utils.js',
    '/js/data.js',
    '/js/analytics.js',
    '/js/ui.js',
    '/js/app.js',
    '/img/LOGO.png',
    '/img/LOGO.svg',
    '/iconfont/iconfont.css',
    '/iconfont/iconfont.ttf'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: 缓存静态资源');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // 立即激活新的Service Worker
                return self.skipWaiting();
            })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: 删除旧缓存', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // 立即控制所有页面
                return self.clients.claim();
            })
    );
});

// 请求拦截 - 网络优先策略（适用于API请求），缓存优先策略（适用于静态资源）
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API请求使用网络优先策略
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // 如果网络请求成功，缓存响应
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // 网络失败时，尝试从缓存中获取
                    return caches.match(request);
                })
        );
    } else {
        // 静态资源使用缓存优先策略
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // 返回缓存的响应，同时在后台更新缓存
                        event.waitUntil(
                            fetch(request)
                                .then((response) => {
                                    if (response.ok) {
                                        caches.open(CACHE_NAME)
                                            .then((cache) => {
                                                cache.put(request, response);
                                            });
                                    }
                                })
                                .catch(() => {
                                    // 忽略后台更新错误
                                })
                        );
                        return cachedResponse;
                    }

                    // 缓存中没有，从网络获取
                    return fetch(request)
                        .then((response) => {
                            if (response.ok) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(request, responseClone);
                                    });
                            }
                            return response;
                        });
                })
        );
    }
});

// 消息监听
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
