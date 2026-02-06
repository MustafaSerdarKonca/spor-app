importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

const CACHE_NAME = 'spor-app-v6';
// Initialize Firebase in SW (Required for background messages)
// Config must match your project
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
    // Default browser notification is usually handled automatically if 'notification' key is sent,
    // but if 'data' only is sent, we can customize here.
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/icons/icon-192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/db.js',
    './js/auth.js',
    './js/firebase-config.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // Stale-While-Revalidate strategy for static logic, checking API not needed here since we use IndexedDB
    // For local files, Cache First is safer for offline speed, updated on reload if version changes
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
});
