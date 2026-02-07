import { messaging, getToken, db, auth } from './firebase-config.js';
import { onMessage } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";
import { doc, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export function listenForMessages() {
    onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);
        const { title, body } = payload.notification || {};
        alert(`🔔 Bildirim Geldi! (Uygulama Açık)\n\n${title}\n${body}`);
    });
}

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

                // --- SAVE TO FIRESTORE ---
                // We use setDoc with merge:true to create document if missing, or update if exists.
                // We use arrayUnion to add token to a list (handling multiple devices for same user)

                // Robust check: Use argument OR current auth user
                const effectiveUserId = userId || auth.currentUser?.uid;

                if (effectiveUserId) {
                    try {
                        const userRef = doc(db, "users", effectiveUserId);
                        await setDoc(userRef, {
                            fcmTokens: arrayUnion(token),
                            lastLogin: new Date().toISOString(),
                            email: auth.currentUser?.email || 'unknown' // Helpful for debugging
                        }, { merge: true });
                        console.log("Token saved to Firestore for user:", effectiveUserId);
                        alert('✅ BAŞARILI!\nBildirimler açıldı ve sistem otomatik ayarlandı.');
                    } catch (dbError) {
                        console.error("Error saving token to DB:", dbError);
                        alert('❌ HATA: Token alındı ama veritabanına yazılamadı!\nHata detayı: ' + dbError.message);
                    }
                } else {
                    console.warn("No user ID found, skipping Firestore save.");
                    alert('⚠️ UYARI: Giriş yapmadığınız için sistem otomatik ayarlanamadı. Lütfen giriş yapıp tekrar deneyin.');
                }
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
