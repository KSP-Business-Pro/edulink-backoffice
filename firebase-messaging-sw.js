// EduLink — Firebase Messaging Service Worker ★ JOUR 15
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCHdpDzx8KtCKZ-UAftTBIE10QhWn-tSDfU",
  authDomain:        "edulink-benin.firebaseapp.com",
  projectId:         "edulink-benin",
  storageBucket:     "edulink-benin.firebasestorage.app",
  messagingSenderId: "707963376504",
  appId:             "1:707963376504:web:7c4be393f0151872a9ee8d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notif = payload.notification || {};
  const data  = payload.data || {};
  const title = notif.title || data.title || 'EduLink';
  const body  = notif.body  || data.body  || 'Nouvelle notification';
  const url   = data.url || '/edulink-portail.html';

  return self.registration.showNotification(title, {
    body,
    icon:    '/icon-192.png',
    badge:   '/icon-72.png',
    tag:     data.tag || 'edulink-notif',
    data:    { url },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/edulink-portail.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wcs) {
      for (let i = 0; i < wcs.length; i++) {
        if (wcs[i].url.includes('edulink') && 'focus' in wcs[i]) return wcs[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
