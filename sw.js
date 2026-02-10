// SELF-DESTRUCT SERVICE WORKER
// This SW replaces the old one to unregister itself and clear caches.

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return self.registration.unregister();
        }).then(() => {
            return clients.matchAll();
        }).then((clients) => {
            clients.forEach(client => client.navigate(client.url));
        })
    );
});
