/**
 * Premium Registration & Onboarding Module
 * Handles: registration form, password strength, validation, onboarding wizard
 */
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// ============================================
// COMMON BLOCKED PASSWORDS
// ============================================
const BLOCKED_PASSWORDS = [
    '12345678', '123456789', '1234567890', 'password', 'password1',
    'password123', 'qwerty', 'qwerty123', 'abc12345', 'letmein',
    'welcome', 'monkey123', 'dragon', 'master', 'football',
    'shadow', 'sunshine', 'trustno1', 'iloveyou', 'batman',
    '11111111', '00000000', 'qwertyui', 'asdfghjk', 'zxcvbnm',
    'baseball', 'access', 'hello123', 'charlie', 'donald',
    'passw0rd', 'starwars', 'spor1234', 'fitness1', 'gym12345'
];

// ============================================
// PASSWORD STRENGTH ENGINE
// ============================================
const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, level: '', label: '', color: '' };

    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 10) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Penalties
    if (/^[0-9]+$/.test(password)) score = Math.max(score - 2, 1);
    if (/^[a-zA-Z]+$/.test(password)) score = Math.max(score - 1, 1);
    if (BLOCKED_PASSWORDS.includes(password.toLowerCase())) score = 0;

    // Map score to levels
    if (score <= 2) return { score, level: 'weak', label: 'Zayıf', color: '#EF4444' };
    if (score <= 4) return { score, level: 'medium', label: 'Orta', color: '#F59E0B' };
    if (score <= 6) return { score, level: 'strong', label: 'Güçlü', color: '#10B981' };
    return { score, level: 'very-strong', label: 'Çok Güçlü', color: '#06B6D4' };
};

// ============================================
// FORM VALIDATION
// ============================================
const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateForm = (formData) => {
    const errors = [];

    if (!formData.name || formData.name.trim().length < 2) {
        errors.push({ field: 'reg-name', message: 'Ad soyad en az 2 karakter olmalıdır.' });
    }

    if (!formData.email || !validateEmail(formData.email)) {
        errors.push({ field: 'reg-email', message: 'Geçerli bir e-posta adresi girin.' });
    }

    if (!formData.password || formData.password.length < 8) {
        errors.push({ field: 'reg-password', message: 'Şifre en az 8 karakter olmalıdır.' });
    }

    if (BLOCKED_PASSWORDS.includes(formData.password?.toLowerCase())) {
        errors.push({ field: 'reg-password', message: 'Bu şifre çok yaygın ve güvensiz. Lütfen farklı bir şifre seçin.' });
    }

    if (formData.password !== formData.passwordConfirm) {
        errors.push({ field: 'reg-password-confirm', message: 'Şifreler eşleşmiyor.' });
    }

    if (!formData.kvkkAccepted) {
        errors.push({ field: 'reg-kvkk', message: 'Kullanım koşullarını kabul etmelisiniz.' });
    }

    return errors;
};

// ============================================
// SHOW FIELD ERROR
// ============================================
const showFieldError = (fieldId, message) => {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Remove existing error
    clearFieldError(fieldId);

    field.classList.add('input-error');
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error-msg';
    errorEl.textContent = message;

    const parent = field.closest('.form-group') || field.parentElement;
    parent.appendChild(errorEl);

    // Shake
    parent.classList.add('form-shake');
    setTimeout(() => parent.classList.remove('form-shake'), 500);
};

const clearFieldError = (fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.remove('input-error');
    const parent = field.closest('.form-group') || field.parentElement;
    const existing = parent.querySelector('.field-error-msg');
    if (existing) existing.remove();
};

const clearAllErrors = () => {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
};

// ============================================
// REGISTRATION FORM SETUP
// ============================================
export const setupRegistration = () => {
    const registerForm = document.getElementById('register-form');
    const registerAlert = document.getElementById('register-alert');
    if (!registerForm) return;

    // --- Password Strength Meter ---
    const passwordInput = document.getElementById('reg-password');
    const strengthMeter = document.getElementById('password-strength-meter');
    const strengthLabel = document.getElementById('password-strength-label');
    const strengthBar = document.getElementById('password-strength-bar');

    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            const strength = calculatePasswordStrength(val);

            if (strengthBar && strengthLabel) {
                if (!val) {
                    strengthMeter.style.display = 'none';
                } else {
                    strengthMeter.style.display = 'block';
                    const pct = Math.min((strength.score / 8) * 100, 100);
                    strengthBar.style.width = pct + '%';
                    strengthBar.style.backgroundColor = strength.color;
                    strengthLabel.textContent = strength.label;
                    strengthLabel.style.color = strength.color;
                }
            }

            // Clear error while typing
            clearFieldError('reg-password');
        });
    }

    // --- Password Confirm Match ---
    const confirmInput = document.getElementById('reg-password-confirm');
    const matchIndicator = document.getElementById('password-match-indicator');

    if (confirmInput) {
        confirmInput.addEventListener('input', () => {
            const pass = passwordInput?.value || '';
            const confirm = confirmInput.value;

            if (!confirm) {
                if (matchIndicator) matchIndicator.style.display = 'none';
            } else if (pass === confirm) {
                if (matchIndicator) {
                    matchIndicator.style.display = 'block';
                    matchIndicator.textContent = '✓ Şifreler eşleşiyor';
                    matchIndicator.className = 'password-match-indicator match-ok';
                }
            } else {
                if (matchIndicator) {
                    matchIndicator.style.display = 'block';
                    matchIndicator.textContent = '✗ Şifreler eşleşmiyor';
                    matchIndicator.className = 'password-match-indicator match-error';
                }
            }
            clearFieldError('reg-password-confirm');
        });
    }

    // --- Password Toggle ---
    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = '🙈';
                btn.setAttribute('aria-label', 'Şifreyi gizle');
            } else {
                input.type = 'password';
                btn.textContent = '👁';
                btn.setAttribute('aria-label', 'Şifreyi göster');
            }
        });
    });

    // --- Email Real-time Validation ---
    const emailInput = document.getElementById('reg-email');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const val = emailInput.value.trim();
            if (val && !validateEmail(val)) {
                showFieldError('reg-email', 'Geçerli bir e-posta adresi girin.');
            } else {
                clearFieldError('reg-email');
            }
        });
    }

    // --- Form Submit ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors();

        const formData = {
            name: document.getElementById('reg-name')?.value?.trim() || '',
            email: document.getElementById('reg-email')?.value?.trim() || '',
            password: document.getElementById('reg-password')?.value || '',
            passwordConfirm: document.getElementById('reg-password-confirm')?.value || '',
            kvkkAccepted: document.getElementById('reg-kvkk')?.checked || false
        };

        // Validate
        const errors = validateForm(formData);
        if (errors.length > 0) {
            errors.forEach(err => showFieldError(err.field, err.message));
            return;
        }

        // Loading state
        const submitBtn = document.getElementById('btn-register-submit');
        const originalHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="btn-spinner"></span> Kayıt olunuyor...';
        submitBtn.disabled = true;

        try {
            // Create user
            const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

            // Update display name
            await updateProfile(cred.user, {
                displayName: formData.name
            });

            // Send email verification
            await sendEmailVerification(cred.user);
            console.log('Verification email sent to:', formData.email);

            // Save initial profile
            await setDoc(doc(db, "users", cred.user.uid, "profile", "info"), {
                displayName: formData.name,
                email: formData.email,
                emailVerified: false,
                createdAt: new Date().toISOString(),
                onboardingComplete: false
            }, { merge: true });

            // Show email verification gate — user MUST verify before continuing
            showEmailVerificationGate(cred.user, formData.email);

        } catch (error) {
            console.error('Register error:', error.code, error.message);
            submitBtn.innerHTML = originalHTML;
            submitBtn.disabled = false;

            // Show inline error using the existing auth-alert system
            if (registerAlert) {
                const errMap = getRegisterErrorMessage(error.code);
                registerAlert.innerHTML = `
                    <div class="auth-alert-content">
                        <span class="auth-alert-icon">${errMap.icon}</span>
                        <div class="auth-alert-text">
                            <strong>${errMap.title}</strong>
                            <p>${errMap.message}</p>
                        </div>
                        <button type="button" class="auth-alert-close" onclick="this.closest('.auth-alert').style.display='none'">✕</button>
                    </div>
                `;
                registerAlert.style.display = 'block';
                registerAlert.classList.remove('auth-alert-show');
                requestAnimationFrame(() => registerAlert.classList.add('auth-alert-show'));
            }
        }
    });
};

// ============================================
// REGISTER ERROR MESSAGES
// ============================================
const getRegisterErrorMessage = (code) => {
    switch (code) {
        case 'auth/email-already-in-use':
            return { icon: '📋', title: 'Hesap Zaten Mevcut', message: 'Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.' };
        case 'auth/invalid-email':
            return { icon: '📧', title: 'Geçersiz E-posta', message: 'Lütfen geçerli bir e-posta adresi girin.' };
        case 'auth/weak-password':
            return { icon: '🔑', title: 'Zayıf Şifre', message: 'Şifreniz yeterince güçlü değil. Daha uzun ve karmaşık bir şifre seçin.' };
        case 'auth/network-request-failed':
            return { icon: '📡', title: 'Bağlantı Hatası', message: 'İnternet bağlantınızı kontrol edip tekrar deneyin.' };
        default:
            return { icon: '❌', title: 'Kayıt Başarısız', message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' };
    }
};

// ============================================
// EMAIL VERIFICATION GATE
// ============================================
let verificationPollTimer = null;

const showEmailVerificationGate = (user, email) => {
    const authCard = document.querySelector('.auth-card');
    if (!authCard) return;

    // Hide both forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';

    // Update subtitle
    const subtitle = document.getElementById('auth-subtitle');
    if (subtitle) subtitle.textContent = 'E-posta Do\u011frulama';

    // Create verification gate UI
    const gateEl = document.createElement('div');
    gateEl.id = 'email-verify-gate';
    gateEl.className = 'email-verify-gate';
    gateEl.innerHTML = `
        <div class="verify-icon">\u2709\uFE0F</div>
        <h3 class="verify-title">E-postan\u0131 Do\u011frula</h3>
        <p class="verify-desc">
            <strong>${email}</strong> adresine bir do\u011frulama ba\u011flant\u0131s\u0131 g\u00f6nderdik.
        </p>
        <div class="verify-steps">
            <div class="verify-step">\u2776 E-posta kutunu kontrol et</div>
            <div class="verify-step">\u2777 Do\u011frulama ba\u011flant\u0131s\u0131na t\u0131kla</div>
            <div class="verify-step">\u2778 Buraya d\u00f6n\u00fcp a\u015fa\u011f\u0131daki butona t\u0131kla</div>
        </div>
        <button type="button" id="btn-verify-check" class="btn-block btn-success">
            \u2705 Do\u011frulad\u0131m, Kontrol Et
        </button>
        <div id="verify-status" class="verify-status" style="display:none;"></div>
        <button type="button" id="btn-verify-resend" class="btn-text verify-resend">
            \uD83D\uDD04 Do\u011frulama e-postas\u0131n\u0131 tekrar g\u00f6nder
        </button>
        <p class="verify-spam-note">Spam/\u00f6nemsiz klas\u00f6r\u00fcn\u00fc de kontrol etmeyi unutma!</p>
    `;
    authCard.appendChild(gateEl);

    // Animate in
    requestAnimationFrame(() => gateEl.classList.add('show'));

    // --- Check Verification Button ---
    const btnCheck = document.getElementById('btn-verify-check');
    const statusEl = document.getElementById('verify-status');

    btnCheck.addEventListener('click', async () => {
        btnCheck.innerHTML = '<span class="btn-spinner"></span> Kontrol ediliyor...';
        btnCheck.disabled = true;

        try {
            await user.reload();
            if (user.emailVerified) {
                // Update profile
                await setDoc(doc(db, "users", user.uid, "profile", "info"), {
                    emailVerified: true
                }, { merge: true });

                // Show success
                statusEl.style.display = 'block';
                statusEl.className = 'verify-status verify-success';
                statusEl.textContent = '\u2705 E-posta do\u011fruland\u0131! Y\u00f6nlendiriliyorsun...';

                // Stop polling
                if (verificationPollTimer) clearInterval(verificationPollTimer);

                // Proceed to onboarding after brief delay
                setTimeout(() => {
                    gateEl.remove();
                    showOnboarding(user.uid);
                }, 1500);
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'verify-status verify-pending';
                statusEl.textContent = '\u23F3 Hen\u00fcz do\u011frulanmam\u0131\u015f. E-postadaki ba\u011flant\u0131ya t\u0131klad\u0131\u011f\u0131ndan emin ol.';
                btnCheck.innerHTML = '\u2705 Do\u011frulad\u0131m, Kontrol Et';
                btnCheck.disabled = false;
            }
        } catch (err) {
            console.error('Verification check failed:', err);
            statusEl.style.display = 'block';
            statusEl.className = 'verify-status verify-error';
            statusEl.textContent = '\u274C Kontrol s\u0131ras\u0131nda hata olu\u015ftu. Tekrar deneyin.';
            btnCheck.innerHTML = '\u2705 Do\u011frulad\u0131m, Kontrol Et';
            btnCheck.disabled = false;
        }
    });

    // --- Resend Button ---
    const btnResend = document.getElementById('btn-verify-resend');
    let resendCooldown = false;

    btnResend.addEventListener('click', async () => {
        if (resendCooldown) return;
        resendCooldown = true;
        btnResend.textContent = '\u23F3 G\u00f6nderiliyor...';

        try {
            await sendEmailVerification(user);
            btnResend.textContent = '\u2705 Tekrar g\u00f6nderildi!';
            setTimeout(() => {
                btnResend.textContent = '\uD83D\uDD04 Do\u011frulama e-postas\u0131n\u0131 tekrar g\u00f6nder';
                resendCooldown = false;
            }, 30000); // 30 sec cooldown
        } catch (err) {
            console.error('Resend failed:', err);
            btnResend.textContent = '\u274C G\u00f6nderilemedi, daha sonra deneyin';
            setTimeout(() => {
                btnResend.textContent = '\uD83D\uDD04 Do\u011frulama e-postas\u0131n\u0131 tekrar g\u00f6nder';
                resendCooldown = false;
            }, 10000);
        }
    });

    // --- Auto-poll every 5 seconds ---
    verificationPollTimer = setInterval(async () => {
        try {
            await user.reload();
            if (user.emailVerified) {
                clearInterval(verificationPollTimer);

                await setDoc(doc(db, "users", user.uid, "profile", "info"), {
                    emailVerified: true
                }, { merge: true });

                statusEl.style.display = 'block';
                statusEl.className = 'verify-status verify-success';
                statusEl.textContent = '\u2705 E-posta do\u011fruland\u0131! Y\u00f6nlendiriliyorsun...';

                setTimeout(() => {
                    gateEl.remove();
                    showOnboarding(user.uid);
                }, 1500);
            }
        } catch (e) {
            // Silent fail for polling
        }
    }, 5000);
};

// ============================================
// SUCCESS ANIMATION (no longer used for email note, kept for future)
// ============================================
const showRegistrationSuccess = () => {
    // This is now replaced by the verification gate
    // Kept as a no-op for backward compatibility
};

// ============================================
// ONBOARDING WIZARD
// ============================================
let onboardingData = {};

const showOnboarding = (userId) => {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    onboardingData = { userId };

    // Show overlay
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Go to step 1
    goToStep(1);

    // Setup step navigation
    setupOnboardingNav(userId);
};

const goToStep = (stepNum) => {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(s => {
        s.classList.remove('active');
    });

    // Show target step
    const target = document.getElementById(`onboarding-step-${stepNum}`);
    if (target) {
        target.classList.add('active');
    }

    // Update progress
    document.querySelectorAll('.step-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i < stepNum);
        dot.classList.toggle('current', i === stepNum - 1);
    });

    // Update step counter
    const counter = document.getElementById('onboarding-step-counter');
    if (counter) counter.textContent = `${stepNum} / 3`;
};

const setupOnboardingNav = (userId) => {
    // Selection cards (single select)
    document.querySelectorAll('.selection-group').forEach(group => {
        group.querySelectorAll('.selection-card').forEach(card => {
            card.addEventListener('click', () => {
                // Deselect siblings
                group.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });
    });

    // Next buttons
    document.getElementById('onboarding-next-1')?.addEventListener('click', () => {
        // Collect step 1 data
        onboardingData.gender = document.querySelector('#onboarding-step-1 .selection-card.selected')?.dataset.value || '';
        onboardingData.age = document.getElementById('ob-age')?.value || '';
        onboardingData.height = document.getElementById('ob-height')?.value || '';
        onboardingData.weight = document.getElementById('ob-weight')?.value || '';
        goToStep(2);
    });

    document.getElementById('onboarding-next-2')?.addEventListener('click', () => {
        // Collect step 2 data
        onboardingData.goal = document.querySelector('#onboarding-step-2 .goal-group .selection-card.selected')?.dataset.value || '';
        onboardingData.level = document.querySelector('#onboarding-step-2 .level-group .selection-card.selected')?.dataset.value || '';
        onboardingData.daysPerWeek = document.getElementById('ob-days')?.value || '';
        goToStep(3);
    });

    document.getElementById('onboarding-finish')?.addEventListener('click', async () => {
        // Collect step 3 data
        onboardingData.split = document.querySelector('#onboarding-step-3 .selection-card.selected')?.dataset.value || '';

        // Save to Firestore
        try {
            await setDoc(doc(db, "users", userId, "profile", "info"), {
                ...onboardingData,
                onboardingComplete: true,
                completedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error('Failed to save profile:', e);
        }

        // Close onboarding
        closeOnboarding();
    });

    // Skip button
    document.getElementById('onboarding-skip')?.addEventListener('click', async () => {
        try {
            await setDoc(doc(db, "users", userId, "profile", "info"), {
                onboardingComplete: true,
                skipped: true,
                completedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error('Failed to save skip:', e);
        }
        closeOnboarding();
    });

    // Back buttons
    document.getElementById('onboarding-back-2')?.addEventListener('click', () => goToStep(1));
    document.getElementById('onboarding-back-3')?.addEventListener('click', () => goToStep(2));
};

const closeOnboarding = () => {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.style.display = 'none';
            // Remove success overlay if still there
            const success = document.querySelector('.reg-success-overlay');
            if (success) success.remove();
        }, 400);
    }

    // Re-trigger the auth state to load the main app
    // The onAuthStateChanged in app.js will handle showing the app
    window.location.reload();
};

// ============================================
// CHECK IF ONBOARDING NEEDED (for new users)
// ============================================
export const checkOnboardingNeeded = async (userId) => {
    try {
        const profileRef = doc(db, "users", userId, "profile", "info");
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            if (!data.onboardingComplete) {
                showOnboarding(userId);
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error('Failed to check onboarding:', e);
        return false;
    }
};

// ============================================
// LEGAL MODALS (Terms / KVKK)
// ============================================
const LEGAL_CONTENT = {
    terms: {
        title: 'Kullanım Koşulları',
        body: `
<h4>1. Genel Hükümler</h4>
<p>Spor App uygulamasını kullanarak aşağıdaki koşulları kabul etmiş olursunuz.</p>

<h4>2. Hizmet Tanımı</h4>
<p>Spor App, kişisel antrenman takibi yapmanızı sağlayan bir mobil uygulamadır. Egzersizlerinizi, ağırlıklarınızı ve gelişiminizi kaydetmenize olanak tanır.</p>

<h4>3. Kullanıcı Yükümlülükleri</h4>
<p>Doğru ve güncel bilgilerle kayıt olmayı, hesap güvenliğinizi sağlamayı ve uygulamayı yasal amaçlarla kullanmayı taahhüt edersiniz.</p>

<h4>4. Veri Sahipliği</h4>
<p>Girdiğiniz antrenman verileri size aittir. Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak kaldırılır.</p>

<h4>5. Sorumluluk Reddi</h4>
<p>Uygulama tıbbi tavsiye sağlamaz. Antrenman programlarınızı bir uzmanla planlamanız önerilir. Spor App, yanlış kullanımdan doğan sonuçlardan sorumlu değildir.</p>

<h4>6. Değişiklikler</h4>
<p>Bu koşullar önceden bildirimde bulunmak suretiyle güncellenebilir.</p>
        `
    },
    kvkk: {
        title: 'KVKK Aydınlatma Metni',
        body: `
<h4>Kişisel Verilerin Korunması</h4>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, veri sorumlusu sıfatıyla aşağıdaki bilgilendirmeyi yaparız.</p>

<h4>Toplanan Veriler</h4>
<ul>
<li><strong>Kimlik Bilgileri:</strong> Ad soyad, e-posta adresi</li>
<li><strong>Sağlık/Fitness Verileri:</strong> Yaş, boy, kilo, antrenman hedefleri, egzersiz kayıtları</li>
<li><strong>Kullanım Verileri:</strong> Giriş zamanları, cihaz bilgileri</li>
</ul>

<h4>Verilerin İşlenme Amaçları</h4>
<ul>
<li>Antrenman takip hizmetinin sunulması</li>
<li>Kişiselleştirilmiş deneyim sağlanması</li>
<li>Hesap güvenliğinin korunması</li>
</ul>

<h4>Verilerin Saklanması</h4>
<p>Verileriniz Google Firebase altyapısında şifreli olarak saklanır. Üçüncü taraflarla paylaşılmaz.</p>

<h4>Haklarınız</h4>
<ul>
<li>Verilerinize erişim talep etme</li>
<li>Verilerinizin düzeltilmesini isteme</li>
<li>Verilerinizin silinmesini talep etme</li>
<li>Veri işlemeye itiraz etme</li>
</ul>

<p>Haklarınızı kullanmak için uygulama içi destek bölümünden bizimle iletişime geçebilirsiniz.</p>
        `
    }
};

window.showLegalModal = (type) => {
    const content = LEGAL_CONTENT[type];
    if (!content) return;

    const overlay = document.getElementById('legal-modal-overlay');
    const title = document.getElementById('legal-modal-title');
    const body = document.getElementById('legal-modal-body');

    if (!overlay || !title || !body) return;

    title.textContent = content.title;
    body.innerHTML = content.body;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));
};

window.closeLegalModal = () => {
    const overlay = document.getElementById('legal-modal-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
};
