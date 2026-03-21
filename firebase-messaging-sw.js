// ══════════════════════════════════════════════════════════════
//  EduLink — Firebase Messaging Service Worker  ★ JOUR 15
//  À placer à la RACINE de votre repo GitHub (même niveau que index.html)
// ══════════════════════════════════════════════════════════════

// ⚠️ IMPORTANT : Remplacez ces valeurs par votre config Firebase
// Firebase Console → Paramètres du projet → Vos applications → SDK Config
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── CONFIGURATION FIREBASE (à personnaliser) ──────────────────
const FIREBASE_CONFIG = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT_ID.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// ── Réception message en arrière-plan ────────────────────────
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW EduLink] Message reçu en arrière-plan:', payload);

  const notif = payload.notification || {};
  const data  = payload.data || {};

  const title   = notif.title || data.title || 'EduLink';
  const body    = notif.body  || data.body  || 'Nouvelle notification';
  const icon    = notif.icon  || '/icon-192.png';
  const badge   = '/icon-72.png';
  const tag     = data.tag   || 'edulink-notif';
  const url     = data.url   || '/edulink-portail.html';

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url },
    requireInteraction: data.important === 'true',
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ],
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(title, options);
});

// ── Clic sur la notification ──────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/edulink-portail.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Vérifier si un onglet EduLink est déjà ouvert
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('edulink') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIF_CLICK', url });
          return;
        }
      }
      // Sinon ouvrir un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ── Push event (Web Push standard) ───────────────────────────
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'EduLink';
      const options = {
        body:   data.body || '',
        icon:   data.icon || '/icon-192.png',
        badge:  '/icon-72.png',
        data:   data,
        tag:    data.tag || 'edulink',
        vibrate:[200,100,200]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch(e) {
      console.warn('[SW EduLink] Push parse error:', e);
    }
  }
});
