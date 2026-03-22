// EduLink — Firebase Messaging Service Worker ★ JOUR 15
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ── Configuration Firebase RÉELLE EduLink-Benin ──
firebase.initializeApp({
  apiKey:            "AIzaSyCHdpDzx8KtCKZ-UAftTBIE1OQhWn-tSDfU",
  authDomain:        "edulink-benin.firebaseapp.com",
  projectId:         "edulink-benin",
  storageBucket:     "edulink-benin.firebasestorage.app",
  messagingSenderId: "707963376504",
  appId:             "1:707963376504:web:7c4be393f0151872a9ee8d"
});

const messaging = firebase.messaging();

// ── Réception message en arrière-plan ──
messaging.onBackgroundMessage(function(payload) {
  const notif = payload.notification || {};
  const data  = payload.data || {};
  const title = notif.title || data.title || 'EduLink';
  const body  = notif.body  || data.body  || 'Nouvelle notification';
  const url   = data.url || '/edulink-portail.html';

  return self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-72.png',
    tag:   data.tag || 'edulink-notif',
    data:  { url },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  });
});

// ── Clic sur notification ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/edulink-portail.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('edulink') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
