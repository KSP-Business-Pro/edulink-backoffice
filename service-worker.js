// ════════════════════════════════════════════════════════════════════════════
//  EduLink — Service Worker  ★ JOUR 17
//  PWA : Cache stratégique, Mode hors-ligne, Sync arrière-plan, Push Notifs
// ════════════════════════════════════════════════════════════════════════════

const SW_VERSION    = 'edulink-v17';
const STATIC_CACHE  = SW_VERSION + '-static';
const DYNAMIC_CACHE = SW_VERSION + '-dynamic';

// ── Assets à pré-cacher lors de l'installation ─────────────────────────────
const STATIC_ASSETS = [
  './',
  './index.html',
  './edulink-portail.html',
  './edulink-auth.js',
  './edulink-notif.js',
];

// ── Domaines toujours en réseau (API, Supabase, Firebase) ──────────────────
const NETWORK_ONLY = [
  'supabase.co',
  'supabase.in',
  'firebaseapp.com',
  'googleapis.com',
  'gstatic.com',
  'fcm.googleapis.com',
  'brevo.com',
  'sibapi.com',
  'cloudflare.com',
  'jsdelivr.net',
  'cdnjs.cloudflare.com',
];

// ── Extensions de fichiers statiques à cacher agressivement ───────────────
const STATIC_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg',
                            '.ico', '.woff', '.woff2', '.ttf', '.gif', '.webp'];


// ════════════════════════════════════════════════════════════════════════════
//  INSTALL — Pré-cacher les assets statiques
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] ✅ Installation EduLink v17');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll fail-safe : on tente chaque URL individuellement
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn('[SW] Cache asset failed:', url, err.message)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});


// ════════════════════════════════════════════════════════════════════════════
//  ACTIVATE — Nettoyer les anciens caches
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] ✅ Activation EduLink v17');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('edulink-') && k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => {
            console.log('[SW] 🗑️ Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});


// ════════════════════════════════════════════════════════════════════════════
//  FETCH — Stratégie de cache adaptative
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  // Ne traiter que les requêtes GET HTTP/HTTPS
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // 1) Réseau uniquement pour les API externes
  const isNetworkOnly = NETWORK_ONLY.some((d) => url.hostname.includes(d));
  if (isNetworkOnly) return;

  // 2) Cache-first pour les assets statiques (polices, images, scripts)
  const ext = url.pathname.slice(url.pathname.lastIndexOf('.'));
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname) ||
                        STATIC_EXTENSIONS.includes(ext);
  if (isStaticAsset) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }

  // 3) Network-first avec fallback cache pour les pages HTML
  event.respondWith(networkFirstStrategy(event.request));
});

/** Cache-First : cache → réseau → mise à jour cache */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Ressource non disponible hors-ligne.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Network-First : réseau → cache (fallback hors-ligne) */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Hors-ligne : tenter le cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback navigation → index.html
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html') ||
                       await caches.match('./edulink-portail.html');
      if (fallback) return fallback;
    }

    return new Response(
      JSON.stringify({ error: 'offline', message: 'EduLink est en mode hors-ligne.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC — File d'attente hors-ligne
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  console.log('[SW] 🔄 Background Sync déclenché :', event.tag);

  if (event.tag === 'edulink-sync') {
    event.waitUntil(traiterFileSyncOffline());
  }
});

async function traiterFileSyncOffline() {
  try {
    // Notifier tous les onglets ouverts que la sync est terminée
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.postMessage({
        type:      'EDULINK_SYNC_DONE',
        timestamp: Date.now(),
        message:   'Données synchronisées avec succès.',
      });
    });
    console.log('[SW] ✅ Sync terminée —', clients.length, 'client(s) notifié(s)');
  } catch (err) {
    console.warn('[SW] Sync échouée :', err.message);
    throw err; // Retry automatique par le navigateur
  }
}


// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES — Communication avec les clients
// ════════════════════════════════════════════════════════════════════════════
let firebaseCfg = null;

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {

    // Config Firebase reçue depuis le portail ou le back-office
    case 'EDULINK_FIREBASE_CONFIG':
      firebaseCfg = data.firebaseConfig;
      console.log('[SW] 🔥 Config Firebase reçue');
      break;

    // Forcer la mise à jour immédiate du SW
    case 'EDULINK_SKIP_WAITING':
      self.skipWaiting();
      break;

    // Déclencher un Background Sync manuellement
    case 'EDULINK_REQUEST_SYNC':
      self.registration.sync?.register('edulink-sync')
        .then(() => console.log('[SW] Sync demandée'))
        .catch((e) => console.warn('[SW] Sync register failed:', e.message));
      break;

    // Vider le cache dynamique (après logout)
    case 'EDULINK_CLEAR_CACHE':
      caches.delete(DYNAMIC_CACHE)
        .then(() => console.log('[SW] Cache dynamique vidé'));
      break;
  }
});


// ════════════════════════════════════════════════════════════════════════════
//  PUSH NOTIFICATIONS — Réception et affichage
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push reçu sans données');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: '🎓 EduLink', body: event.data.text() } };
  }

  // Normalisation du payload (FCM Legacy vs FCM v1)
  const notif = payload.notification || {};
  const data  = payload.data || {};

  const titre  = notif.title || data.title || '🎓 EduLink';
  const corps  = notif.body  || data.body  || '';
  const url    = data.url    || './edulink-portail.html';
  const tag    = data.tag    || 'edulink-' + Date.now();
  const urgent = data.priorite === 'high' || payload.priority === 'high';

  // Icônes selon le type
  const ICONES = {
    absence:  '/icons/icon-192.png',
    note:     '/icons/icon-192.png',
    examen:   '/icons/icon-192.png',
    paiement: '/icons/icon-192.png',
    annonce:  '/icons/icon-192.png',
    message:  '/icons/icon-192.png',
  };

  const options = {
    body:              corps,
    icon:              notif.icon || ICONES[data.type] || '/icons/icon-192.png',
    badge:             '/icons/badge-72.png',
    tag,
    data:              { url, ecole_id: data.ecole_id, type: data.type },
    vibrate:           urgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
    renotify:          true,
    requireInteraction: urgent,
    silent:            false,
    actions: [
      { action: 'open',    title: '📖 Ouvrir' },
      { action: 'dismiss', title: '✕ Ignorer' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(titre, options)
  );
});


// ════════════════════════════════════════════════════════════════════════════
//  CLIC SUR NOTIFICATION
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  notification.close();

  // Action "Ignorer" → ne rien faire
  if (action === 'dismiss') return;

  const targetUrl = notification.data?.url || './edulink-portail.html';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Tenter de mettre le focus sur un onglet déjà ouvert
        for (const client of clients) {
          const clientPath = new URL(client.url).pathname;
          const targetPath = new URL(targetUrl, self.location.origin).pathname;
          if (clientPath === targetPath && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon ouvrir un nouvel onglet
        return self.clients.openWindow(targetUrl);
      })
  );
});


// ════════════════════════════════════════════════════════════════════════════
//  FERMETURE NOTIFICATION (suivi analytique éventuel)
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclose', (event) => {
  const { tag, data } = event.notification;
  console.log('[SW] Notification fermée :', tag, '| type :', data?.type || '—');
});


// ════════════════════════════════════════════════════════════════════════════
//  PERIODIC BACKGROUND SYNC (navigateurs supportés)
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'edulink-daily-sync') {
    event.waitUntil(traiterFileSyncOffline());
  }
});


console.log('[SW] 🎓 EduLink Service Worker JOUR 17 chargé ✅ — Cache:', SW_VERSION);
