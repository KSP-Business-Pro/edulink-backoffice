// ══════════════════════════════════════════════════════════════════════
//  EduLink — firebase-messaging-sw.js   ★ JOUR 15 — Portail Famille
//  À placer à la RACINE du serveur (même niveau que index.html)
//  Ce fichier gère les notifications push en arrière-plan (background)
// ══════════════════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

let messaging    = null;
let initialized  = false;

// ── Recevoir la config Firebase depuis le thread principal ────────────
// Le portail envoie la config après l'avoir chargée depuis Supabase.
// Raison : le SW n'a pas accès à Supabase directement.
self.addEventListener('message', function(event) {
  const { type, firebaseConfig } = event.data || {};
  if (type !== 'EDULINK_FIREBASE_CONFIG' || !firebaseConfig || initialized) return;

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    messaging   = firebase.messaging();
    initialized = true;

    // ── Messages reçus quand l'app est en arrière-plan ────────────
    messaging.onBackgroundMessage(function(payload) {
      const notif = payload.notification || {};
      const data  = payload.data        || {};

      const title   = notif.title || data.title || '🎓 EduLink';
      const options = {
        body:              notif.body || data.body || '',
        icon:              '/icon-192.png',
        badge:             '/icon-72.png',
        tag:               data.tag  || ('edulink-' + Date.now()),
        data:              { url: data.url || '/edulink-portail.html' },
        vibrate:           [200, 100, 200],
        requireInteraction: false
      };
      return self.registration.showNotification(title, options);
    });

    console.log('[FCM SW] Firebase initialisé avec succès');
  } catch(err) {
    console.warn('[FCM SW] Erreur init Firebase :', err.message);
  }
});

// ── Clic sur une notification ─────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/edulink-portail.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(windowClients) {
        // Si un onglet portail est déjà ouvert → focus
        for (const client of windowClients) {
          if (client.url.includes('edulink-portail') && 'focus' in client) {
            return client.navigate(targetUrl).then(c => c.focus()).catch(() => client.focus());
          }
        }
        // Sinon → ouvrir un nouvel onglet
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ── Cycle de vie du Service Worker ───────────────────────────────────
self.addEventListener('install',  ()   => self.skipWaiting());
self.addEventListener('activate', (ev) => ev.waitUntil(clients.claim()));
