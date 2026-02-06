import { messaging, getToken } from './firebase-config.js';

export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            // TODO: VAPID Key gereklidir.
            // Firebase Console -> Project Settings -> Cloud Messaging -> Web Push Certificates
            // Bu anahtarı buraya yazmanız gerekecek.
            const token = await getToken(messaging, {
                vapidKey: 'BNxfKVpbJ7lNwkkjb-K_PY-uAKKgPrd15YL1ncyIKgnMNzgzzMFiKoLUDN0v4T5NGDzB4v259T4XzsYFtTBsXQM' // Placeholder
            });

            if (token) {
                console.log('FCM Token:', token);
                alert('Bildirimler açıldı!\n\nToken (Konsol için):\n' + token);
                // In a real app, you would send this token to your server (Firestore)
                // saveTokenToDatabase(token);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
            alert('Bildirim izni verilmedi.');
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        // Special error handling for missing VAPID key
        if (err.code === 'messaging/missing-current-browser-visible-push-public-key') {
            alert('HATA: VAPID Key eksik. Lütfen kurulum rehberini okuyun.');
        }
    }
};
