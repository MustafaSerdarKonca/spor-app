import { messaging, getToken } from './firebase-config.js';

export async function subscribeUserToPush(userId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Tarayıcınız Web Push desteklemiyor.');
        return;
    }

    try {
        // 1. Get Permission
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');

            // 2. Get FCM Token
            // VAPID Key: Firebase Console -> Project Settings -> Cloud Messaging -> Web Push Certificates
            // Bu anahtarı buraya girmeniz GEREKİYOR.
            const VAPID_KEY = 'BNxfKVpbJ7lNwkkjb-K_PY-uAKKgPrd15YL1ncyIKgnMNzgzzMFiKoLUDN0v4T5NGDzB4v259T4XzsYFtTBsXQM';

            if (VAPID_KEY === 'YOUR_PUBLIC_VAPID_KEY_HERE') {
                alert('⚠️ GELİŞTİRİCİ DİKKATİ: js/notifications.js dosyasına VAPID Key eklenmelidir!');
                return;
            }

            // Get Service Worker Registration
            const registration = await navigator.serviceWorker.ready;

            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('FCM Token:', token);

                // Show on screen
                const tokenDiv = document.getElementById('token-display');
                const tokenText = document.getElementById('token-text');
                if (tokenDiv && tokenText) {
                    tokenDiv.style.display = 'block';
                    tokenText.textContent = token;
                }

                alert('Abonelik Başarılı! En altta çıkan Token kodunu kopyalayın.');
            } else {
                console.log('No registration token available.');
            }
        } else {
            alert('Bildirim izni reddedildi.');
        }
    } catch (err) {
        console.error('An error occurred while retrieving token. ', err);
        alert('Hata: ' + err.message);
    }
}

export async function sendTestNotification(userId) {
    try {
        // Since we are serverless, we can't send a real notification from client.
        // Instead, let's use this button to help user retrieve their Token again.

        const VAPID_KEY = 'BNxfKVpbJ7lNwkkjb-K_PY-uAKKgPrd15YL1ncyIKgnMNzgzzMFiKoLUDN0v4T5NGDzB4v259T4XzsYFtTBsXQM';

        // Get Service Worker Registration
        const registration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {
            // Show on screen
            const tokenDiv = document.getElementById('token-display');
            const tokenText = document.getElementById('token-text');
            if (tokenDiv && tokenText) {
                tokenDiv.style.display = 'block';
                tokenText.textContent = token;

                // Scroll to bottom
                tokenDiv.scrollIntoView({ behavior: 'smooth' });
            }
            alert('Token tekrar alındı ve aşağıya yazıldı. \n\nBu Token\'ı kopyalayıp Firebase Console -> Cloud Messaging kısmından test bildirimi atabilirsiniz.');
        } else {
            alert('Henüz token yok. Lütfen önce ZİL (🔔) ikonuna basıp izin verin.');
        }
    } catch (e) {
        console.error(e);
        alert('Token alınamadı: ' + e.message);
    }
}
