/**
 * Spor App Logic
 */
import { initDB, getDay, saveDay } from './db.js';
import { processImage } from './image_utils.js';

const DAYS = [
    { id: 'mon', label: 'PZT' },
    { id: 'tue', label: 'SAL' },
    { id: 'wed', label: 'ÇAR' },
    { id: 'thu', label: 'PER' },
    { id: 'fri', label: 'CUM' },
    { id: 'sat', label: 'CTS' },
    { id: 'sun', label: 'PAZ' }
];

let currentDayId = 'mon'; // Default
let currentDayData = { dayId: 'mon', exercises: [] };

// DOM Elements
const dayTabsContainer = document.querySelector('.day-tabs');
const exerciseList = document.getElementById('exercise-list');
const fab = document.getElementById('fab-add');
const modalOverlay = document.getElementById('modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const exerciseForm = document.getElementById('exercise-form');

// Initialization
const init = async () => {
    setupTabs();

    // Determine current day of week (0=Sun, 1=Mon...)
    const todayIndex = new Date().getDay();
    // Convert JS day (Sun=0) to our array (Mon=0..Sun=6)
    // Sunday (0) should be index 6. 1-6 are 0-5.
    const mappedIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    currentDayId = DAYS[mappedIndex].id;

    // Highlight initial tab
    updateActiveTab();

    // Load Data
    await loadCurrentDay();
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
    await loadCurrentDay();
};

const updateActiveTab = () => {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        if (tab.dataset.id === currentDayId) {
            tab.classList.add('active');
            // Scroll to active tab
            tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } else {
            tab.classList.remove('active');
        }
    });
};

const loadCurrentDay = async () => {
    exerciseList.innerHTML = '<div style="padding:20px;text-align:center">Yükleniyor...</div>';
    try {
        const data = await getDay(currentDayId);
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
                <h3>Bugün boş görünüyor</h3>
                <p>Antrenmana başlamak için " + " butonuna basarak hareket ekle.</p>
            </div>
        `;
        return;
    }

    currentDayData.exercises.forEach((ex, index) => {
        const card = document.createElement('div');
        card.className = 'exercise-card fade-in';
        card.style.animationDelay = `${index * 0.05}s`;

        const historyBubbles = ex.history.slice(0, 3).map(w => `<span class="weight-bubble">${w}</span>`).join('');
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
        // Add to history (beginning)
        currentDayData.exercises[exIndex].history.unshift(val);
        // Keep only top 3 implies we just need last 3? User said "son 3 değer".
        // Often users want to keep history forever but VIEW last 3. 
        // For MVP simplicity and requested structure "weights[son3]", we can just keep 3 or keep all.
        // Prompt says "4. olursa en eski düşsün" -> So literally only keep 3.
        if (currentDayData.exercises[exIndex].history.length > 3) {
            currentDayData.exercises[exIndex].history.pop();
        }

        await saveDay(currentDayData);
        renderExercises();
    }
};

window.deleteExercise = async (exerciseId) => {
    if (confirm('Bu hareketi silmek istediğine emin misin?')) {
        currentDayData.exercises = currentDayData.exercises.filter(e => e.id !== exerciseId);
        await saveDay(currentDayData);
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

closeModalBtn.onclick = () => {
    modalOverlay.classList.remove('open');
};
modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('open');
};

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

    await saveDay(currentDayData);
    modalOverlay.classList.remove('open');
    renderExercises();
};


// Optional: View Full Image
window.viewImage = (src) => {
    // Simple alert or modal for now. User didn't strictly request lightbox, but useful.
    // For now, just logging or could open in new tab.
    // To match MVP, we won't overengineer a lightbox yet.
};

// --- Boot ---
init();

// Expose global methods because modules isolate scope, but we use inline onclick="" in HTML
// Alternatively, we could attach listeners in renderExercises, but this is simpler for MVP.
