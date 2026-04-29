import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyA18EFuGFq9TuAC7S-fw6nq8VY_X9H6Omw",
    authDomain: "spor-app-98027.firebaseapp.com",
    projectId: "spor-app-98027",
    storageBucket: "spor-app-98027.firebasestorage.app",
    messagingSenderId: "38427901547",
    appId: "1:38427901547:web:b78bd902af1b9e2ccebb2e",
    measurementId: "G-FSTPRB5MC1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// ── Kalıcı oturum: tarayıcı / PWA kapatılsa bile giriş korunur ───────────────
// browserLocalPersistence → IndexedDB/localStorage tabanlı;
// iOS Safari PWA standalone modu dahil tüm platformlarda çalışır.
setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('Auth persistence ayarlanamadı:', err.message);
});

// Firestore offline persistence
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence: birden fazla sekme açık');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence bu tarayıcıda desteklenmiyor');
        }
    });

export { auth, db, messaging, getToken };
