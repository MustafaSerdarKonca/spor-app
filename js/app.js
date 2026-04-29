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
import { initTimer, autoStartTimer } from './timer.js';

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
            initTimer();
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
        card.dataset.exerciseId = ex.id;
        card.dataset.index = index;

        const historyBubbles = ex.history.slice(0, 3).map(entry => {
            let weight, dateStr;
            if (typeof entry === 'object' && entry !== null) {
                weight = entry.weight;
                try {
                    const date = new Date(entry.date);
                    dateStr = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                } catch (e) {
                    dateStr = '';
                }
            } else {
                weight = entry;
                dateStr = '';
            }

            return `
                <div class="weight-bubble-container">
                    ${dateStr ? `<span class="bubble-date">${dateStr}</span>` : ''}
                    <span class="weight-bubble">${weight}</span>
                </div>
            `;
        }).join('');
        const imageHtml = ex.image ? `<img src="${ex.image}" class="exercise-thumb" alt="${ex.name}" onclick="viewImage('${ex.image}')">` : '';

        const fullHistoryCount = Array.isArray(ex.fullHistory) ? ex.fullHistory.length : 0;
        const historyBtnLabel = fullHistoryCount > 0
            ? `📊 Geçmiş <span class="history-count-badge">${fullHistoryCount}</span>`
            : '📊 Geçmiş';

        card.innerHTML = `
            <div class="card-content-wrapper">
                <button class="drag-handle" aria-label="Sırayı değiştir" title="Basılı tutup sürükle">⠿</button>
                ${imageHtml}
                <div class="card-details">
                    <div class="card-header">
                        <h4 class="exercise-name">${ex.name}</h4>
                        <div>
                            <button class="btn-icon history-toggle-btn" onclick="toggleHistory('${ex.id}')" title="Tüm geçmişi gör">${historyBtnLabel}</button>
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
            <!-- Full History Panel (hidden by default) -->
            <div class="full-history-panel" id="full-history-${ex.id}" style="display:none;">
                <div class="full-history-header">
                    <span class="full-history-title">📋 Tüm Ağırlık Geçmişi</span>
                    <span class="full-history-subtitle">${fullHistoryCount} kayıt</span>
                </div>
                <div class="full-history-list" id="full-history-list-${ex.id}">
                    ${fullHistoryCount === 0
                        ? '<p class="full-history-empty">Henüz kayıt yok. İlk ağırlığını ekle!</p>'
                        : renderFullHistoryHTML(ex.fullHistory)
                    }
                </div>
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

        // --- Quick view: son 3 kayıt (mevcut davranış korunuyor) ---
        currentDayData.exercises[exIndex].history.unshift(newEntry);
        if (currentDayData.exercises[exIndex].history.length > 3) {
            currentDayData.exercises[exIndex].history.pop();
        }

        // --- Full history: sınırsız, tüm kayıtlar ---
        if (!Array.isArray(currentDayData.exercises[exIndex].fullHistory)) {
            currentDayData.exercises[exIndex].fullHistory = [];
        }
        currentDayData.exercises[exIndex].fullHistory.unshift(newEntry);

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
        // Dinlenme sayacını otomatik başlat
        autoStartTimer();
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
    window.open(src, '_blank');
};

// --- Full History Renderer ---
const renderFullHistoryHTML = (fullHistory) => {
    if (!fullHistory || fullHistory.length === 0) {
        return '<p class="full-history-empty">Henüz kayıt yok.</p>';
    }

    // Tarihe göre grupla (YYYY-MM-DD)
    const groups = {};
    fullHistory.forEach(entry => {
        let weight, dateObj;
        if (typeof entry === 'object' && entry !== null && entry.date) {
            weight = entry.weight;
            dateObj = new Date(entry.date);
        } else {
            weight = entry;
            dateObj = null;
        }

        const groupKey = dateObj
            ? dateObj.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Tarih bilinmiyor';
        const timeStr = dateObj
            ? dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : '';

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push({ weight, timeStr });
    });

    // HTML oluştur
    return Object.entries(groups).map(([dateLabel, entries]) => `
        <div class="fh-group">
            <div class="fh-group-date">${dateLabel}</div>
            <div class="fh-group-entries">
                ${entries.map(e => `
                    <div class="fh-entry">
                        <span class="fh-weight">${e.weight} <small>kg</small></span>
                        ${e.timeStr ? `<span class="fh-time">${e.timeStr}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
};

// Toggle full history panel
window.toggleHistory = (exerciseId) => {
    const panel = document.getElementById(`full-history-${exerciseId}`);
    const btn = document.querySelector(`[onclick="toggleHistory('${exerciseId}')"]`);
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        panel.style.display = 'none';
        panel.classList.remove('fh-panel-open');
        if (btn) btn.classList.remove('active');
    } else {
        panel.style.display = 'block';
        // Kısa gecikme ile animasyon
        requestAnimationFrame(() => panel.classList.add('fh-panel-open'));
        if (btn) btn.classList.add('active');
    }
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

// ============================================
// DRAG & DROP REORDING
// ============================================

const initDragAndDrop = () => {
    let draggedCard = null;
    let dragClone = null;
    let startY = 0;
    let startX = 0;
    let dragStartIndex = -1;
    let currentHoverIndex = -1;
    let longPressTimer = null;
    let isDragging = false;

    const LONG_PRESS_DURATION = 300; // ms to trigger drag on touch

    const getCards = () => Array.from(exerciseList.querySelectorAll('.exercise-card'));

    const getCardAtPoint = (x, y) => {
        const cards = getCards();
        for (const card of cards) {
            if (card === draggedCard) continue;
            const rect = card.getBoundingClientRect();
            if (y >= rect.top && y <= rect.bottom) {
                return card;
            }
        }
        return null;
    };

    const startDrag = (card, clientX, clientY) => {
        isDragging = true;
        draggedCard = card;
        dragStartIndex = parseInt(card.dataset.index);
        currentHoverIndex = dragStartIndex;

        // Create visual clone
        const rect = card.getBoundingClientRect();
        dragClone = card.cloneNode(true);
        dragClone.className = 'exercise-card drag-clone';
        dragClone.style.width = rect.width + 'px';
        dragClone.style.left = rect.left + 'px';
        dragClone.style.top = rect.top + 'px';
        document.body.appendChild(dragClone);

        // Mark original card
        card.classList.add('drag-placeholder');

        // Vibrate for haptic feedback (mobile)
        if (navigator.vibrate) navigator.vibrate(30);

        startY = clientY;
        startX = clientX;
    };

    const moveDrag = (clientX, clientY) => {
        if (!isDragging || !dragClone) return;

        // Move clone
        const dy = clientY - startY;
        dragClone.style.transform = `translateY(${dy}px) scale(1.03)`;

        // Check which card we're over
        const targetCard = getCardAtPoint(clientX, clientY);
        if (targetCard && targetCard !== draggedCard) {
            const targetIndex = parseInt(targetCard.dataset.index);
            if (targetIndex !== currentHoverIndex) {
                currentHoverIndex = targetIndex;
                reorderCards(dragStartIndex, targetIndex);
            }
        }
    };

    const endDrag = async () => {
        if (!isDragging) return;
        isDragging = false;

        // Remove clone
        if (dragClone) {
            dragClone.remove();
            dragClone = null;
        }

        // Remove placeholder class
        if (draggedCard) {
            draggedCard.classList.remove('drag-placeholder');
        }

        // If order changed, save
        if (dragStartIndex !== currentHoverIndex && currentHoverIndex >= 0) {
            // Reorder the actual data array
            const movedItem = currentDayData.exercises.splice(dragStartIndex, 1)[0];
            currentDayData.exercises.splice(currentHoverIndex, 0, movedItem);

            if (currentUser) {
                await saveDay(currentUser.uid, currentDayData);
            }

            // Re-render with new order
            renderExercises();
            showToast('✅ Sıralama güncellendi');
        } else {
            // Reset styles
            getCards().forEach(c => {
                c.style.transition = '';
                c.style.transform = '';
            });
        }

        draggedCard = null;
        dragStartIndex = -1;
        currentHoverIndex = -1;
    };

    const reorderCards = (fromIndex, toIndex) => {
        const cards = getCards();

        // Visual reorder: swap DOM positions smoothly
        cards.forEach(card => {
            card.style.transition = 'transform 0.2s ease';
        });

        // Calculate visual offsets
        if (fromIndex < toIndex) {
            // Moving down: shift cards between from+1..to UP
            cards.forEach(card => {
                const idx = parseInt(card.dataset.index);
                if (idx > fromIndex && idx <= toIndex) {
                    const cardHeight = draggedCard.offsetHeight + 14; // 14px margin
                    card.style.transform = `translateY(-${cardHeight}px)`;
                } else if (idx === fromIndex) {
                    const totalShift = cards.slice(fromIndex + 1, toIndex + 1)
                        .reduce((sum, c) => sum + c.offsetHeight + 14, 0);
                    card.style.transform = `translateY(${totalShift}px)`;
                } else {
                    card.style.transform = '';
                }
            });
        } else {
            // Moving up: shift cards between to..from-1 DOWN
            cards.forEach(card => {
                const idx = parseInt(card.dataset.index);
                if (idx >= toIndex && idx < fromIndex) {
                    const cardHeight = draggedCard.offsetHeight + 14;
                    card.style.transform = `translateY(${cardHeight}px)`;
                } else if (idx === fromIndex) {
                    const totalShift = cards.slice(toIndex, fromIndex)
                        .reduce((sum, c) => sum + c.offsetHeight + 14, 0);
                    card.style.transform = `translateY(-${totalShift}px)`;
                } else {
                    card.style.transform = '';
                }
            });
        }
    };

    const cancelDrag = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (isDragging) endDrag();
    };

    // --- Touch Events ---
    exerciseList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        const card = handle.closest('.exercise-card');
        if (!card) return;

        e.preventDefault();
        const touch = e.touches[0];

        longPressTimer = setTimeout(() => {
            startDrag(card, touch.clientX, touch.clientY);
        }, LONG_PRESS_DURATION);
    }, { passive: false });

    exerciseList.addEventListener('touchmove', (e) => {
        if (longPressTimer && !isDragging) {
            // User is scrolling, cancel long press
            clearTimeout(longPressTimer);
            longPressTimer = null;
            return;
        }
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    exerciseList.addEventListener('touchend', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        endDrag();
    });

    exerciseList.addEventListener('touchcancel', cancelDrag);

    // --- Mouse Events ---
    exerciseList.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        const card = handle.closest('.exercise-card');
        if (!card) return;

        e.preventDefault();
        startDrag(card, e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) endDrag();
    });
};

// Initialize drag and drop
initDragAndDrop();
