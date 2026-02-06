import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const btnGoogle = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');

// State
let isRegistering = false;

// Global Toggle Function (exposed to window for onclick in HTML)
window.toggleAuthMode = () => {
    isRegistering = !isRegistering;
    if (isRegistering) {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }
};

export const setupAuthListeners = () => {
    // Check Config
    if (auth.app.options.apiKey === "YOUR_API_KEY" || auth.app.options.apiKey.includes("API_KEY")) {
        alert("UYARI: Firebase Ayarları yapılmadı!\nLütfen 'js/firebase-config.js' dosyasını düzenleyin.\n(Detaylar için: firebase_setup_instructions.md)");
    }

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // State change listener in app.js will handle redirect
        } catch (error) {
            alert("Giriş başarısız: " + error.message);
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;

        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            // Success
        } catch (error) {
            alert("Kayıt başarısız: " + error.message);
        }
    });

    // Google
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error(error);
                alert("Google ile giriş başarısız: " + error.message);
            }
        });
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error(error);
            }
        });
    }
};

export const updateUIForUser = (user) => {
    if (user) {
        // Show App
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        appContainer.style.display = 'block'; // Ensure block
    } else {
        // Show Auth
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        // Reset forms
        loginForm.reset();
        registerForm.reset();
    }
};
