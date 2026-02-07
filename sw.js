importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const CACHE_NAME = 'spor-app-v10'; // Incremented version
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/db.js',
    './js/auth.js',
    './js/firebase-config.js',
    './js/notifications.js',
    './manifest.json'
];

// Initialize Firebase in SW (Required for background messages)
firebase.initializeApp({
    apiKey: "AIzaSyA18EFuGFq9TuAC7S-fw6nq8VY_X9H6Omw",
    authDomain: "spor-app-98027.firebaseapp.com",
    projectId: "spor-app-98027",
    storageBucket: "spor-app-98027.firebasestorage.app",
    messagingSenderId: "38427901547",
    appId: "1:38427901547:web:b78bd902af1b9e2ccebb2e",
    measurementId: "G-FSTPRB5MC1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icons/icon-192.png',
        data: { url: payload.data?.url || '/' } // Pass URL if available
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- Install & Activate (Caching) ---

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Cache First for assets, Network First for API (if any)
    // Here using Stale-While-Revalidate logic for simplicity
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// --- Notification Click Handling ---

self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click received.');

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window open and focus it
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
