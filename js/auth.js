import { auth } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const btnGoogle = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');
const loginAlert = document.getElementById('login-alert');
const registerAlert = document.getElementById('register-alert');

// State
let isRegistering = false;

// --- Error Message Mapping ---
const getAuthErrorMessage = (errorCode) => {
    switch (errorCode) {
        // Login errors
        case 'auth/user-not-found':
            return {
                icon: '👤',
                title: 'Kullanıcı Bulunamadı',
                message: 'Bu e-posta adresiyle kayıtlı bir hesap yok. Lütfen kayıt olun.',
                showRegister: true
            };
        case 'auth/wrong-password':
            return {
                icon: '🔒',
                title: 'Şifre Hatalı',
                message: 'Girdiğiniz şifre yanlış. Lütfen tekrar deneyin.',
                showRegister: false
            };
        case 'auth/invalid-credential':
            return {
                icon: '⚠️',
                title: 'Giriş Başarısız',
                message: 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.',
                showRegister: false
            };
        case 'auth/invalid-email':
            return {
                icon: '📧',
                title: 'Geçersiz E-posta',
                message: 'Lütfen geçerli bir e-posta adresi girin.',
                showRegister: false
            };
        case 'auth/too-many-requests':
            return {
                icon: '⏳',
                title: 'Çok Fazla Deneme',
                message: 'Çok fazla başarısız giriş denemesi yaptınız. Lütfen birkaç dakika bekleyin.',
                showRegister: false
            };
        case 'auth/user-disabled':
            return {
                icon: '🚫',
                title: 'Hesap Devre Dışı',
                message: 'Bu hesap devre dışı bırakılmış. Destek ile iletişime geçin.',
                showRegister: false
            };
        case 'auth/network-request-failed':
            return {
                icon: '📡',
                title: 'Bağlantı Hatası',
                message: 'İnternet bağlantınızı kontrol edip tekrar deneyin.',
                showRegister: false
            };

        // Register errors
        case 'auth/email-already-in-use':
            return {
                icon: '📋',
                title: 'Hesap Zaten Mevcut',
                message: 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.',
                showLogin: true
            };
        case 'auth/weak-password':
            return {
                icon: '🔑',
                title: 'Zayıf Şifre',
                message: 'Şifreniz en az 6 karakter olmalıdır.',
                showRegister: false
            };

        // Default
        default:
            return {
                icon: '❌',
                title: 'Bir Hata Oluştu',
                message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
                showRegister: false
            };
    }
};

// --- Show Inline Alert ---
const showAuthAlert = (alertEl, errorCode, context = 'login') => {
    if (!alertEl) return;

    const err = getAuthErrorMessage(errorCode);

    let actionHtml = '';
    if (err.showRegister) {
        actionHtml = `<button type="button" class="auth-alert-action" onclick="toggleAuthMode()">Kayıt Ol →</button>`;
    } else if (err.showLogin) {
        actionHtml = `<button type="button" class="auth-alert-action" onclick="toggleAuthMode()">Giriş Yap →</button>`;
    }

    alertEl.innerHTML = `
        <div class="auth-alert-content">
            <span class="auth-alert-icon">${err.icon}</span>
            <div class="auth-alert-text">
                <strong>${err.title}</strong>
                <p>${err.message}</p>
            </div>
            <button type="button" class="auth-alert-close" onclick="this.closest('.auth-alert').style.display='none'">✕</button>
        </div>
        ${actionHtml}
    `;

    alertEl.style.display = 'block';

    // Animate in
    alertEl.classList.remove('auth-alert-show');
    requestAnimationFrame(() => {
        alertEl.classList.add('auth-alert-show');
    });

    // Shake the form inputs briefly
    const form = alertEl.closest('form');
    if (form) {
        form.classList.add('form-shake');
        setTimeout(() => form.classList.remove('form-shake'), 500);
    }

    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (alertEl.style.display !== 'none') {
            alertEl.classList.remove('auth-alert-show');
            setTimeout(() => { alertEl.style.display = 'none'; }, 300);
        }
    }, 8000);
};

// --- Hide Alert ---
const hideAuthAlert = (alertEl) => {
    if (alertEl) {
        alertEl.style.display = 'none';
        alertEl.classList.remove('auth-alert-show', 'auth-alert-success');
    }
};

// --- Show Inline Success ---
const showAuthSuccess = (alertEl, title, message) => {
    if (!alertEl) return;

    alertEl.innerHTML = `
        <div class="auth-alert-content">
            <span class="auth-alert-icon">✅</span>
            <div class="auth-alert-text">
                <strong>${title}</strong>
                <p>${message}</p>
            </div>
            <button type="button" class="auth-alert-close" onclick="this.closest('.auth-alert').style.display='none'">✕</button>
        </div>
    `;

    alertEl.classList.add('auth-alert-success');
    alertEl.style.display = 'block';

    alertEl.classList.remove('auth-alert-show');
    requestAnimationFrame(() => alertEl.classList.add('auth-alert-show'));

    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (alertEl.style.display !== 'none') {
            alertEl.classList.remove('auth-alert-show');
            setTimeout(() => {
                alertEl.style.display = 'none';
                alertEl.classList.remove('auth-alert-success');
            }, 300);
        }
    }, 8000);
};

// Global Toggle Function (exposed to window for onclick in HTML)
window.toggleAuthMode = () => {
    isRegistering = !isRegistering;
    // Hide any active alerts when switching
    hideAuthAlert(loginAlert);
    hideAuthAlert(registerAlert);

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
        const submitBtn = document.getElementById('btn-login-submit');

        // Hide previous alert
        hideAuthAlert(loginAlert);

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Giriş yapılıyor...';
        submitBtn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // State change listener in app.js will handle redirect
        } catch (error) {
            console.error('Login error:', error.code, error.message);
            showAuthAlert(loginAlert, error.code, 'login');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const submitBtn = document.getElementById('btn-register-submit');

        // Hide previous alert
        hideAuthAlert(registerAlert);

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Kayıt olunuyor...';
        submitBtn.disabled = true;

        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            // Success
        } catch (error) {
            console.error('Register error:', error.code, error.message);
            showAuthAlert(registerAlert, error.code, 'register');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Google
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error('Google login error:', error.code, error.message);
                showAuthAlert(loginAlert, error.code, 'login');
            }
        });
    }

    // Forgot Password
    const btnForgot = document.getElementById('btn-forgot-password');
    if (btnForgot) {
        btnForgot.addEventListener('click', async () => {
            const emailInput = document.getElementById('login-email');
            const email = emailInput ? emailInput.value.trim() : '';

            // Email boşsa input'u vurgula ve hata göster
            if (!email) {
                showAuthAlert(loginAlert, 'auth/invalid-email', 'login');
                if (emailInput) {
                    emailInput.focus();
                    emailInput.style.borderColor = 'var(--danger)';
                    setTimeout(() => { emailInput.style.borderColor = ''; }, 2000);
                }
                return;
            }

            // Buton loading state
            const originalText = btnForgot.textContent;
            btnForgot.textContent = 'Gönderiliyor...';
            btnForgot.disabled = true;

            try {
                await sendPasswordResetEmail(auth, email);
                showAuthSuccess(
                    loginAlert,
                    'E-posta Gönderildi',
                    `${email} adresine şifre sıfırlama bağlantısı gönderildi. Spam klasörünü de kontrol etmeyi unutma.`
                );
            } catch (error) {
                console.error('Password reset error:', error.code, error.message);
                showAuthAlert(loginAlert, error.code, 'login');
            } finally {
                btnForgot.textContent = originalText;
                btnForgot.disabled = false;
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
    // Her durumda splash'i kaldır (Firebase auth state belirlendi)
    const splash = document.getElementById('auth-splash');
    if (splash) {
        splash.style.transition = 'opacity 0.3s ease';
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 300);
    }

    if (user) {
        // Show App
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        appContainer.style.display = 'block';
        hideAuthAlert(loginAlert);
        hideAuthAlert(registerAlert);
    } else {
        // Show Auth
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        loginForm.reset();
        registerForm.reset();
    }
};
