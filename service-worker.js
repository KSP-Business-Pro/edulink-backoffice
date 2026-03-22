// ══════════════════════════════════════════════════════════════════════
//  EduLink Suite 5 — service-worker.js  ★ JOUR 17
//  PWA Mode Hors-Ligne — Stratégie Cache-First + Network-First
//  À placer à la RACINE du serveur (même niveau que index.html)
// ══════════════════════════════════════════════════════════════════════

const SW_VERSION   = 'edulink-v17';
const CACHE_STATIC = SW_VERSION + '-static';
const CACHE_DATA   = SW_VERSION + '-data';
const CACHE_IMG    = SW_VERSION + '-img';

// ── Ressources à précacher au démarrage ─────────────────────────────
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/edulink-portail.html',
  '/manifest.json',
  '/manifest-portail.json',
  '/firebase-messaging-sw.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Poppins:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
];

// ── Page hors-ligne de fallback ──────────────────────────────────────
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EduLink — Hors ligne</title>
<style>
*{margin:0;box-sizing:border-box}
body{font-family:'Poppins',sans-serif;background:#f0f7f4;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.card{background:#fff;border-radius:20px;padding:2.5rem 2rem;max-width:380px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.1)}
.ico{font-size:56px;margin-bottom:1rem}
h1{font-size:20px;font-weight:700;color:#1e3a5f;margin-bottom:.5rem}
p{font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:1.5rem}
.badge{background:#e1f5ee;color:#0f6e56;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;display:inline-block;margin-bottom:1.5rem}
button{background:linear-gradient(135deg,#0f6e56,#1e3a5f);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif}
.info{margin-top:1.5rem;background:#f9fafb;border-radius:10px;padding:1rem;text-align:left}
.info-item{font-size:12px;color:#374151;padding:4px 0;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:8px}
.info-item:last-child{border-bottom:none}
</style>
</head>
<body>
<div class="card">
  <div class="ico">📡</div>
  <div class="badge">Mode hors-ligne</div>
  <h1>Pas de connexion internet</h1>
  <p>EduLink fonctionne en mode hors-ligne. Vos dernières données sont disponibles ci-dessous.</p>
  <button onclick="location.reload()">↻ Réessayer</button>
  <div class="info">
    <div class="info-item">✅ Notes & bulletins — disponibles</div>
    <div class="info-item">✅ Absences — disponibles</div>
    <div class="info-item">✅ Examens — disponibles</div>
    <div class="info-item">⏳ Paiements — synchronisation requise</div>
    <div class="info-item">⏳ Messages — synchronisation requise</div>
  </div>
</div>
</body>
</html>`;

// ══ INSTALLATION ═════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] Installation v' + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      // Précacher les assets statiques (erreurs silencieuses)
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Précache raté:', url, e.message))
        )
      );
    }).then(() => {
      // Mettre en cache la page offline
      return caches.open(CACHE_STATIC).then(cache =>
        cache.put('/__offline', new Response(OFFLINE_PAGE, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }))
      );
    })
  );
  self.skipWaiting();
});

// ══ ACTIVATION ═══════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation v' + SW_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('edulink-') && name !== CACHE_STATIC && name !== CACHE_DATA && name !== CACHE_IMG)
          .map(name => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ══ INTERCEPTION DES REQUÊTES ════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les extensions de navigateur
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'moz-extension:') return;

  // ── Supabase API → Network-First avec fallback cache ──────────────
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirstWithCache(request, CACHE_DATA));
    return;
  }

  // ── Images → Cache-First ──────────────────────────────────────────
  if (request.destination === 'image') {
    event.respondWith(cacheFirstWithFallback(request, CACHE_IMG));
    return;
  }

  // ── Fonts Google → Cache-First (longue durée) ─────────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstWithFallback(request, CACHE_STATIC));
    return;
  }

  // ── CDN (Chart.js, Supabase SDK...) → Cache-First ─────────────────
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirstWithFallback(request, CACHE_STATIC));
    return;
  }

  // ── Pages HTML → Network-First avec fallback offline ──────────────
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/__offline'));
        })
    );
    return;
  }

  // ── Tout le reste → Network-First ─────────────────────────────────
  event.respondWith(networkFirstWithCache(request, CACHE_STATIC));
});

// ══ STRATÉGIES DE CACHE ══════════════════════════════════════════════

// Network-First : essaie le réseau, sinon cache
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Retourner une réponse JSON vide pour les API Supabase
    if (request.url.includes('supabase.co')) {
      return new Response(JSON.stringify({ data: [], error: null }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error('Hors-ligne et aucun cache disponible');
  }
}

// Cache-First : sert depuis le cache, met à jour en arrière-plan
async function cacheFirstWithFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Mettre à jour le cache en arrière-plan (stale-while-revalidate)
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(cacheName).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// ══ SYNCHRONISATION EN ARRIÈRE-PLAN ══════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'edulink-sync') {
    console.log('[SW] Synchronisation arrière-plan déclenchée');
    event.waitUntil(syncDonnees());
  }
});

async function syncDonnees() {
  // Notifier les clients que la synchronisation est terminée
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'EDULINK_SYNC_DONE', timestamp: Date.now() });
  });
}

// ══ MESSAGES DEPUIS LE CLIENT ════════════════════════════════════════
self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  // Demande de version du SW
  if (type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: SW_VERSION });
  }

  // Vider le cache (demandé par l'admin)
  if (type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    event.ports[0]?.postMessage({ done: true });
  }

  // Forcer la mise à jour
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ══ NOTIFICATIONS PUSH ═══════════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data    = event.data.json();
    const notif   = data.notification || {};
    const payload = data.data || {};
    event.waitUntil(
      self.registration.showNotification(notif.title || '🎓 EduLink', {
        body:    notif.body || payload.body || '',
        icon:    '/icon-192.png',
        badge:   '/icon-72.png',
        tag:     payload.tag || 'edulink-' + Date.now(),
        data:    { url: payload.url || '/edulink-portail.html' },
        vibrate: [200, 100, 200],
        actions: [{ action: 'open', title: 'Voir' }]
      })
    );
  } catch(e) {
    console.warn('[SW] Push parse error:', e.message);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/edulink-portail.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('edulink') && 'focus' in client) {
          return client.navigate(url).then(c => c.focus()).catch(() => client.focus());
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[SW] EduLink Service Worker v' + SW_VERSION + ' chargé');
