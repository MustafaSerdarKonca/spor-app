/**
 * Spor App Logic
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { setupAuthListeners, updateUIForUser } from './auth.js';
import { subscribeUserToPush, listenForMessages } from './notifications.js';
// We currently keep using local DB logic for operations, but will guard it with auth state.
// Future step: Switch 'db.js' to use Firestore 'db' instance.
import { getDay, saveDay } from './db.js';
import { processImage } from './image_utils.js';

// --- Toast Notification Utility ---
const showToast = (message, type = 'success', duration = 2000) => {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger show
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-hide
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

const DAYS = [
    { id: 'mon', label: 'PZT', bg: 'assets/bg_mon.png' },
    { id: 'tue', label: 'SAL', bg: 'assets/bg_tue.png' },
    { id: 'wed', label: 'ÇAR', bg: 'assets/bg_wed.png' },
    { id: 'thu', label: 'PER', bg: 'assets/bg_thu.png' },
    { id: 'fri', label: 'CUM', bg: 'assets/bg_fri.png' },
    { id: 'sat', label: 'CTS', bg: 'assets/bg_sat.png' },
    { id: 'sun', label: 'PAZ', bg: 'assets/bg_sun.png' }
];

let currentDayId = 'mon'; // Default
let currentDayData = { dayId: 'mon', exercises: [] };
let currentUser = null; // Store current user

// DOM Elements
const dayTabsContainer = document.querySelector('.day-tabs');
const exerciseList = document.getElementById('exercise-list');
const fab = document.getElementById('fab-add');
const modalOverlay = document.getElementById('modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const exerciseForm = document.getElementById('exercise-form');

// Initialization
const init = async () => {
    setupAuthListeners();

    // Listen to Auth State
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        updateUIForUser(user);

        if (user) {
            console.log("Logged in:", user.email);
            // Initialize App
            setupTabs();
            // Determine current day
            const todayIndex = new Date().getDay();
            const mappedIndex = todayIndex === 0 ? 6 : todayIndex - 1;
            currentDayId = DAYS[mappedIndex].id;
            updateActiveTab();
            updateBackground(currentDayId);
            await loadCurrentDay();
        } else {
            console.log("Logged out");
        }
    });
};

const setupTabs = () => {
    dayTabsContainer.innerHTML = '';
    DAYS.forEach(day => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.textContent = day.label;
        btn.dataset.id = day.id;
        btn.onclick = () => switchDay(day.id);
        dayTabsContainer.appendChild(btn);
    });
};

const switchDay = async (dayId) => {
    currentDayId = dayId;
    updateActiveTab();
    updateBackground(dayId);
    await loadCurrentDay();
};

const updateBackground = (dayId) => {
    const day = DAYS.find(d => d.id === dayId);
    if (day && day.bg) {
        document.body.style.setProperty('--bg-image', `url('${day.bg}')`);
    }
};

const updateActiveTab = () => {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.dataset.id === currentDayId) {
            tab.classList.add('active');
            tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            tab.classList.remove('active');
        }
    });
};

const loadCurrentDay = async () => {
    if (!currentUser) return; // Guard

    exerciseList.innerHTML = '<div style="padding:20px;text-align:center">Yükleniyor...</div>';

    try {
        const data = await getDay(currentUser.uid, currentDayId);
        if (data) {
            currentDayData = data;
        } else {
            // Initialize empty day if not exists
            currentDayData = { dayId: currentDayId, exercises: [] };
        }
        renderExercises();
    } catch (e) {
        console.error('Failed to load data', e);
        exerciseList.innerHTML = 'Hata oluştu.';
    }
};

const renderExercises = () => {
    exerciseList.innerHTML = '';

    if (currentDayData.exercises.length === 0) {
        exerciseList.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">🏋️</span>
                <h3>Bugün boş görünüyor</h3>
                <p>Antrenmana başlamak için aşağıdaki <strong>+</strong> butonuna bas.</p>
            </div>
        `;
        return;
    }

    currentDayData.exercises.forEach((ex, index) => {
        const card = document.createElement('div');
        card.className = 'exercise-card fade-in';
        card.style.animationDelay = `${index * 0.05}s`;

        const historyBubbles = ex.history.slice(0, 3).map(entry => {
            let weight, dateStr;
            if (typeof entry === 'object' && entry !== null) {
                weight = entry.weight;
                // Format date: "10 Eki" always
                try {
                    const date = new Date(entry.date);
                    dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                } catch (e) {
                    dateStr = '';
                }
            } else {
                weight = entry;
                dateStr = ''; // Retroactive: could show '-' or nothing
            }

            return `
                <div class="weight-bubble-container">
                    ${dateStr ? `<span class="bubble-date">${dateStr}</span>` : ''}
                    <span class="weight-bubble">${weight}</span>
                </div>
            `;
        }).join('');
        const imageHtml = ex.image ? `<img src="${ex.image}" class="exercise-thumb" alt="${ex.name}" onclick="viewImage('${ex.image}')">` : '';

        card.innerHTML = `
            <div class="card-content-wrapper">
                ${imageHtml}
                <div class="card-details">
                    <div class="card-header">
                        <h4 class="exercise-name">${ex.name}</h4>
                        <div>
                            <button class="btn-icon" onclick="openEditModal('${ex.id}')">✎</button>
                            <button class="btn-icon delete" onclick="deleteExercise('${ex.id}')">🗑</button>
                        </div>
                    </div>
                    <div class="exercise-meta">
                        ${ex.tag ? `<span class="badge">${ex.tag}</span>` : ''}
                        ${ex.note ? `<span class="notes">${ex.note}</span>` : ''}
                    </div>
                    <div class="history-section">
                        <span class="history-label">Son:</span>
                        <div class="weight-bubbles">
                            ${historyBubbles || '<span style="color:var(--text-secondary);font-size:13px;">Henüz yok</span>'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="actions">
                <input type="text" inputmode="decimal" class="input-weight" placeholder="Ağırlık (kg)" id="input-${ex.id}">
                <button class="btn-add-weight" onclick="addWeight('${ex.id}')">Ekle</button>
            </div>
        `;
        exerciseList.appendChild(card);
    });
};

// --- Actions ---

window.addWeight = async (exerciseId) => {
    const input = document.getElementById(`input-${exerciseId}`);
    let val = input.value.trim();
    if (!val) return;

    // Convert comma to dot for consistency
    val = val.replace(',', '.');

    // Find exercise
    const exIndex = currentDayData.exercises.findIndex(e => e.id === exerciseId);
    if (exIndex > -1) {
        // Add to history (beginning) with DATE
        // New format: { weight: "10", date: "2023-10-27T..." }
        const newEntry = {
            weight: val,
            date: new Date().toISOString()
        };

        currentDayData.exercises[exIndex].history.unshift(newEntry);
        // Prompt says "4. olursa en eski düşsün"
        if (currentDayData.exercises[exIndex].history.length > 3) {
            currentDayData.exercises[exIndex].history.pop();
        }

        if (currentUser) {
            await saveDay(currentUser.uid, currentDayData);
        }
        renderExercises();

        // Visual feedback: flash the card green
        const cards = document.querySelectorAll('.exercise-card');
        if (cards[exIndex]) {
            cards[exIndex].classList.add('weight-added');
            setTimeout(() => cards[exIndex].classList.remove('weight-added'), 700);
        }

        showToast(`✅ ${val} kg eklendi!`);
    }
};

window.deleteExercise = async (exerciseId) => {
    if (confirm('Bu hareketi silmek istediğine emin misin?')) {
        currentDayData.exercises = currentDayData.exercises.filter(e => e.id !== exerciseId);
        if (currentUser) {
            await saveDay(currentUser.uid, currentDayData);
        }
        renderExercises();
    }
};

// --- Modal & Form ---

// We need to know if we are editing or adding
let editingId = null;
let currentImageBase64 = null; // Temp storage for selected image

// Image Input Handler
const imageInput = document.getElementById('inp-image');
const imagePreview = document.getElementById('image-preview');

if (imageInput) {
    imageInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                imagePreview.textContent = 'İşleniyor...';
                const base64 = await processImage(file);
                currentImageBase64 = base64;
                imagePreview.style.backgroundImage = `url('${base64}')`;
                imagePreview.textContent = '';
            } catch (err) {
                console.error(err);
                imagePreview.textContent = 'Hata';
            }
        }
    };
}

if (fab) {
    fab.onclick = () => {
        editingId = null;
        currentImageBase64 = null;
        document.getElementById('modal-title').textContent = 'Yeni Hareket';
        exerciseForm.reset();
        if (imagePreview) {
            imagePreview.style.backgroundImage = '';
            imagePreview.textContent = 'Görsel Seç';
        }
        modalOverlay.classList.add('open');
    };
}

window.openEditModal = (exId) => {
    editingId = exId;
    const ex = currentDayData.exercises.find(e => e.id === exId);
    if (!ex) return;

    document.getElementById('modal-title').textContent = 'Hareketi Düzenle';
    document.getElementById('inp-name').value = ex.name;
    document.getElementById('inp-tag').value = ex.tag || '';
    document.getElementById('inp-note').value = ex.note || '';

    // Set Image
    currentImageBase64 = ex.image || null;
    if (imagePreview) {
        if (currentImageBase64) {
            imagePreview.style.backgroundImage = `url('${currentImageBase64}')`;
            imagePreview.textContent = '';
        } else {
            imagePreview.style.backgroundImage = '';
            imagePreview.textContent = 'Görsel Seç';
        }
    }

    modalOverlay.classList.add('open');
};

if (closeModalBtn) {
    closeModalBtn.onclick = () => {
        modalOverlay.classList.remove('open');
    };
}
if (modalOverlay) {
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    };
}

if (exerciseForm) {
    exerciseForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('inp-name').value.trim();
        const tag = document.getElementById('inp-tag').value.trim();
        const note = document.getElementById('inp-note').value.trim();

        if (!name) return;

        if (editingId) {
            // Edit
            const ex = currentDayData.exercises.find(e => e.id === editingId);
            if (ex) {
                ex.name = name;
                ex.tag = tag;
                ex.note = note;
                if (currentImageBase64) ex.image = currentImageBase64; // Only update if new image or keeping existing
            }
        } else {
            // Add
            const newEx = {
                id: Date.now().toString(), // Simple ID
                name,
                tag,
                note,
                image: currentImageBase64,
                history: []
            };
            currentDayData.exercises.push(newEx);
        }

        if (currentUser) {
            await saveDay(currentUser.uid, currentDayData);
        }
        modalOverlay.classList.remove('open');
        renderExercises();
    };
}


// Optional: View Full Image
window.viewImage = (src) => {
    // Simple alert or modal for now.
    window.open(src, '_blank');
};

// --- Boot ---
// Call init which sets up auth listener
init();
listenForMessages();

// Button Listeners
document.getElementById('btn-enable-notify')?.addEventListener('click', () => {
    if (currentUser) {
        subscribeUserToPush(currentUser.uid);
    } else {
        alert('Bildirimleri açmak için giriş yapmalısınız.');
    }
});





// Expose global methods because modules isolate scope, but we use inline onclick="" in HTML
// Alternatively, we could attach listeners in renderExercises, but this is simpler for MVP.
