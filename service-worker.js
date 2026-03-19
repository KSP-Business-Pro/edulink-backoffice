/* =====================================================================
   EduLink — Service Worker (PWA)
   Cache offline pour : HTML, JS, CSS, fonts
   ===================================================================== */

var CACHE_NAME    = 'edulink-v5';
var CACHE_OFFLINE = 'edulink-offline';

// Fichiers à mettre en cache au premier chargement
var FILES_TO_CACHE = [
  './edulink-jour5.html',
  './edulink-auth.js',
  './edulink-notif.js',
  './edulink-portail.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js'
];

// Page hors-ligne de secours
var OFFLINE_PAGE = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EduLink — Hors ligne</title>' +
'<style>*{margin:0;box-sizing:border-box;font-family:Arial,sans-serif}body{background:linear-gradient(135deg,#1e3a5f,#0f2040);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}' +
'.card{text-align:center;padding:2.5rem 2rem;background:rgba(255,255,255,.08);border-radius:20px;max-width:400px;border:1px solid rgba(255,255,255,.15)}' +
'.ico{font-size:56px;margin-bottom:1rem}.h1{font-size:22px;font-weight:700;margin-bottom:.5rem}.p{font-size:14px;opacity:.75;margin-bottom:1.5rem;line-height:1.6}' +
'.btn{background:#c97c1a;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer}' +
'</style></head><body><div class="card"><div class="ico">📵</div><h1 class="h1">Vous êtes hors ligne</h1>' +
'<p class="p">EduLink nécessite une connexion Internet pour accéder aux données en temps réel. Vérifiez votre connexion et réessayez.</p>' +
'<button class="btn" onclick="location.reload()">🔄 Réessayer</button></div></body></html>';

// ── INSTALL : mise en cache des fichiers statiques ──
self.addEventListener('install', function(e) {
  console.log('[SW] Installation EduLink v5');
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        FILES_TO_CACHE.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Cache miss:', url, err.message);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE : nettoyer les anciens caches ──
self.addEventListener('activate', function(e) {
  console.log('[SW] Activation EduLink v5');
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH : stratégie Network First pour l'API, Cache First pour les assets ──
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Ne pas intercepter les requêtes Supabase (toujours en réseau)
  if (url.indexOf('supabase.co') !== -1 || url.indexOf('brevo.com') !== -1) {
    return; // laisser passer sans intercepter
  }

  // Requêtes de navigation (HTML) : Network First
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
          return response;
        })
        .catch(function() {
          return caches.match(e.request).then(function(cached) {
            if (cached) return cached;
            return new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          });
        })
    );
    return;
  }

  // Assets statiques : Cache First puis réseau
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        return new Response('', { status: 503 });
      });
    })
  );
});

// ── MESSAGE : forcer mise à jour depuis l'app ──
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── PUSH : notifications push futures ──
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}
  var title   = data.title   || 'EduLink';
  var options = {
    body:    data.body    || 'Vous avez une nouvelle notification.',
    icon:    data.icon    || './icons/icon-192.png',
    badge:   data.badge   || './icons/icon-72.png',
    data:    data.url     || '/',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',   title: 'Ouvrir',  icon: './icons/icon-72.png' },
      { action: 'close',  title: 'Ignorer' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  if (e.action === 'close') return;
  var url = e.notification.data || '/';
  e.waitUntil(clients.openWindow(url));
});
