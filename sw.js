// ===== Service Worker — صيدات العود =====

var CACHE_NAME = 'saidat-v5';

var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/market.html',
  '/product.html',
  '/login.html',
  '/dashboard.html',
  '/sell.html',
  '/privacy.html',
  '/terms.html',
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/header.css',
  '/css/buttons.css',
  '/css/footer.css',
  '/css/badges.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/header.js',
  '/js/ui.js',
  '/js/dashboard-app.js',
  '/js/dashboard-products.js',
  '/js/dashboard-orders.js',
  '/js/dashboard-shipping.js',
  '/js/dashboard-finance.js',
  '/js/dashboard-profile.js',
  '/js/dashboard-support.js',
  '/manifest.json'
];

// ===== التثبيت — تخزين الأصول الثابتة =====
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ===== التفعيل — حذف الكاش القديم =====
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// ===== الاعتراض — Cache-first للثوابت، Network-first لـ API =====
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // API requests (Supabase) — Network-first
  if (url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Static assets — Cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache new static assets
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
