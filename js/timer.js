/**
 * Rest Timer Module — Spor App
 */

const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 SVG circle
const MIN_DURATION  = 30;
const MAX_DURATION  = 10 * 60;

const state = {
    duration:    3 * 60, // seconds
    endTime:     null,
    isRunning:   false,
    isPanelOpen: false,
    intervalId:  null,
};

let els = {};

// ─── Init ────────────────────────────────────────────────────────────────────
export function initTimer() {
    els = {
        panel:         document.getElementById('timer-panel'),
        chip:          document.getElementById('timer-chip'),
        chipTime:      document.getElementById('timer-chip-time'),
        display:       document.getElementById('timer-display'),
        progress:      document.getElementById('timer-progress-circle'),
        btnToggle:     document.getElementById('btn-timer-toggle'),
        btnMinus:      document.getElementById('btn-timer-minus'),
        btnPlus:       document.getElementById('btn-timer-plus'),
        btnClose:      document.getElementById('btn-timer-close'),
        btnOpen:       document.getElementById('btn-timer-open'),
        durationLabel: document.getElementById('timer-duration-label'),
    };

    if (els.progress) {
        els.progress.style.strokeDasharray  = CIRCUMFERENCE;
        els.progress.style.strokeDashoffset = 0;
    }

    els.btnToggle?.addEventListener('click', toggleTimer);
    els.btnMinus?.addEventListener('click',  () => adjustDuration(-30));
    els.btnPlus?.addEventListener('click',   () => adjustDuration(30));
    els.btnClose?.addEventListener('click',  closePanel);
    els.btnOpen?.addEventListener('click',   openPanel);
    els.chip?.addEventListener('click',      openPanel);

    updateDurationLabel();
    updateDisplay(state.duration);

    // Sync timer if app was reopened while timer was running (localStorage)
    const saved = localStorage.getItem('spor_timer_end');
    if (saved) {
        const endTime = parseInt(saved, 10);
        const remaining = endTime - Date.now();
        if (remaining > 0) {
            state.endTime   = endTime;
            state.isRunning = true;
            state.duration  = parseInt(localStorage.getItem('spor_timer_dur') || state.duration, 10);
            els.btnToggle.textContent = 'Durdur';
            els.btnToggle.classList.add('running');
            els.btnMinus.disabled = els.btnPlus.disabled = true;
            state.intervalId = setInterval(tick, 250);
            openPanel();
            tick();
        } else {
            localStorage.removeItem('spor_timer_end');
            localStorage.removeItem('spor_timer_dur');
        }
    }

    // Visibility change: sync when coming back from background
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isRunning && state.endTime) {
            const remaining = state.endTime - Date.now();
            if (remaining <= 0) onFinish();
            else tick();
        }
    });
}

// Auto-start when weight is added
export function autoStartTimer() {
    openPanel();
    if (!state.isRunning) startTimer();
}

// ─── Panel ───────────────────────────────────────────────────────────────────
function openPanel() {
    state.isPanelOpen = true;
    els.panel?.classList.add('open');
    els.chip?.classList.remove('visible');
}

function closePanel() {
    state.isPanelOpen = false;
    els.panel?.classList.remove('open');
    if (state.isRunning) els.chip?.classList.add('visible');
}

// ─── Timer control ───────────────────────────────────────────────────────────
function toggleTimer() {
    if (state.isRunning) stopTimer();
    else startTimer();
}

function startTimer() {
    state.isRunning = true;
    state.endTime   = Date.now() + state.duration * 1000;

    localStorage.setItem('spor_timer_end', state.endTime);
    localStorage.setItem('spor_timer_dur', state.duration);

    els.btnToggle.textContent   = 'Durdur';
    els.btnToggle.classList.add('running');
    els.btnMinus.disabled = els.btnPlus.disabled = true;

    scheduleSwNotification(state.duration * 1000);
    state.intervalId = setInterval(tick, 250);
    tick();
}

function stopTimer() {
    state.isRunning = false;
    state.endTime   = null;
    clearInterval(state.intervalId);
    cancelSwNotification();
    localStorage.removeItem('spor_timer_end');
    localStorage.removeItem('spor_timer_dur');

    els.btnToggle.textContent = 'Başlat';
    els.btnToggle.classList.remove('running');
    els.btnMinus.disabled = els.btnPlus.disabled = false;
    els.chip?.classList.remove('visible');

    updateDisplay(state.duration);
    updateProgress(state.duration, state.duration);
    setProgressColor(1.0);
}

// ─── Tick ────────────────────────────────────────────────────────────────────
function tick() {
    if (!state.endTime) return;
    const remainingMs  = Math.max(0, state.endTime - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);

    updateDisplay(remainingSec);
    updateProgress(remainingSec, state.duration);
    setProgressColor(remainingSec / state.duration);

    if (remainingMs <= 0) onFinish();
}

function onFinish() {
    clearInterval(state.intervalId);
    state.isRunning = false;
    state.endTime   = null;
    localStorage.removeItem('spor_timer_end');
    localStorage.removeItem('spor_timer_dur');

    playFinishSound();
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 600]);

    els.display?.classList.add('timer-done-flash');
    setTimeout(() => els.display?.classList.remove('timer-done-flash'), 2500);

    els.btnToggle.textContent = 'Tekrar Başlat';
    els.btnToggle.classList.remove('running');
    els.btnMinus.disabled = els.btnPlus.disabled = false;

    setTimeout(() => {
        if (!state.isRunning) {
            updateDisplay(state.duration);
            updateProgress(state.duration, state.duration);
            setProgressColor(1.0);
            els.btnToggle.textContent = 'Başlat';
        }
    }, 3000);

    if (!state.isPanelOpen) openPanel();
    els.chip?.classList.remove('visible');
}

// ─── Adjust duration ─────────────────────────────────────────────────────────
function adjustDuration(delta) {
    state.duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, state.duration + delta));
    updateDurationLabel();
    updateDisplay(state.duration);
    updateProgress(state.duration, state.duration);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
function updateDisplay(sec) {
    const m   = Math.floor(sec / 60);
    const s   = sec % 60;
    const str = `${m}:${String(s).padStart(2, '0')}`;
    if (els.display)  els.display.textContent  = str;
    if (els.chipTime) els.chipTime.textContent = str;
}

function updateProgress(remaining, total) {
    if (!els.progress) return;
    const ratio  = total > 0 ? remaining / total : 1;
    const offset = CIRCUMFERENCE * (1 - ratio);
    els.progress.style.strokeDashoffset = offset;
}

function setProgressColor(ratio) {
    if (!els.progress) return;
    let color;
    if (ratio > 0.5)      color = '#3B82F6';   // blue
    else if (ratio > 0.25) color = '#F59E0B';   // amber
    else                   color = '#EF4444';   // red
    els.progress.style.stroke = color;
    if (els.display) els.display.style.color = ratio <= 0.25 ? '#FCA5A5' : '';
}

function updateDurationLabel() {
    const m = Math.floor(state.duration / 60);
    const s = state.duration % 60;
    if (els.durationLabel)
        els.durationLabel.textContent = s === 0 ? `${m} dakika` : `${m}:${String(s).padStart(2,'0')}`;
}

// ─── Sound ───────────────────────────────────────────────────────────────────
function playFinishSound() {
    try {
        const ctx   = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [
            { freq: 523, delay: 0,   dur: 0.25 },
            { freq: 659, delay: 280, dur: 0.25 },
            { freq: 784, delay: 560, dur: 0.5  },
        ];
        notes.forEach(n => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type            = 'sine';
            osc.frequency.value = n.freq;
            const t = ctx.currentTime + n.delay / 1000;
            gain.gain.setValueAtTime(0.7, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
            osc.start(t);
            osc.stop(t + n.dur + 0.05);
        });
    } catch (e) { console.warn('Audio error:', e); }
}

// ─── Service Worker background notification ───────────────────────────────────
async function scheduleSwNotification(delayMs) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
            type:    'TIMER_START',
            endTime: Date.now() + delayMs,
            title:   '💪 Dinlenme Bitti!',
            body:    'Set arası süren doldu. Hazır olduğunda devam et!',
        });
    } catch (e) { console.warn('SW timer msg failed:', e); }
}

async function cancelSwNotification() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({ type: 'TIMER_CANCEL' });
    } catch (e) { /* ignore */ }
}
