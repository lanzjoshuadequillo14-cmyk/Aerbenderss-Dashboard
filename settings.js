// ============================================================
//  settings.js — AeroCube threshold & buzzer settings
//  Imports shared Firebase config from firebase.js
// ============================================================

import { db, auth, BASE_PATH } from './firebase.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'Registration.html';
});

document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await signOut(auth); window.location.href = 'Registration.html'; }
  catch (err) { console.error("Logout error:", err); }
});

// --- MOBILE MENU ---
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

const savedAeroCubeId = localStorage.getItem('aerocube-id') || BASE_PATH.split('/').pop();
const savedAeroPlugId = localStorage.getItem('aeroplug-id') || 'plug_01';
const aeroCubePath = '/Aerocubes/' + savedAeroCubeId;
const deviceSelectorForm = document.getElementById('device-selector-form');
const aerocubeIdInput = document.getElementById('aerocube-id');
const aeroplugIdInput = document.getElementById('aeroplug-id');

if (aerocubeIdInput) aerocubeIdInput.value = savedAeroCubeId;
if (aeroplugIdInput) aeroplugIdInput.value = savedAeroPlugId;

deviceSelectorForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const cubeId = aerocubeIdInput.value.trim();
  const plugId = aeroplugIdInput.value.trim();
  const validId = /^[A-Za-z0-9_-]+$/;
  if (!validId.test(cubeId) || !validId.test(plugId)) return;
  localStorage.setItem('aerocube-id', cubeId);
  localStorage.setItem('aeroplug-id', plugId);
  window.location.reload();
});

menuToggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

// --- DOM ELEMENTS ---
const valCo2 = document.getElementById('val-co2');
const sliderCo2 = document.getElementById('slider-co2');
const valVoc = document.getElementById('val-voc');
const sliderVoc = document.getElementById('slider-voc');
const valPmAqi = document.getElementById('val-pmaqi');
const sliderPmAqi = document.getElementById('slider-pmaqi');
const selectCo2Outlet = document.getElementById('select-co2-outlet');
const selectVocOutlet = document.getElementById('select-voc-outlet');
const selectPmAqiOutlet = document.getElementById('select-pmaqi-outlet');
const btnSave = document.getElementById('btn-save');
const switchBuzzer = document.getElementById('switch-buzzer');
const textBuzzer = document.getElementById('text-buzzer');
const btnClean = document.getElementById('btn-sps30clean');
const textSps30Status = document.getElementById('text-sps30-status');
const modalConfirm = document.getElementById('modal-confirm');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');
let cleaningRequestStarted = false;

// ============================================================
//  1. FETCH LIVE SETTINGS FROM FIREBASE
// ============================================================
onValue(ref(db, aeroCubePath + '/settings'), (snapshot) => {
  const settings = snapshot.val();
  if (!settings) return;

  // Update threshold sliders from Firebase values
  if (settings.co2Threshold !== undefined) {
    sliderCo2.value = settings.co2Threshold;
    valCo2.innerHTML = settings.co2Threshold + ' <span>ppm</span>';
  }
  if (settings.vocThreshold !== undefined) {
    sliderVoc.value = settings.vocThreshold;
    valVoc.innerHTML = settings.vocThreshold + ' <span>idx</span>';
  }
  if (settings.pmAQIThreshold !== undefined) {
    sliderPmAqi.value = settings.pmAQIThreshold;
    valPmAqi.innerHTML = settings.pmAQIThreshold + ' <span>AQI</span>';
  }
  if (settings.co2Outlet !== undefined) selectCo2Outlet.value = settings.co2Outlet;
  if (settings.vocOutlet !== undefined) selectVocOutlet.value = settings.vocOutlet;
  if (settings.pmAQIOutlet !== undefined) selectPmAqiOutlet.value = settings.pmAQIOutlet;
});

// ============================================================
//  2. LISTEN FOR BUZZER STATE FROM CONTROLS
// ============================================================
onValue(ref(db, aeroCubePath + '/controls/isBuzzerSilenced'), (snapshot) => {
  const isSilenced = snapshot.val();
  if (isSilenced !== undefined && switchBuzzer) {
    // checked = buzzer ON (enabled), unchecked = SILENCED
    switchBuzzer.checked = !isSilenced;
    textBuzzer.innerText = isSilenced ? 'SILENCED' : 'ON';
    switchBuzzer.disabled = false;
  }
});

onValue(ref(db, aeroCubePath + '/settings/sps30Clean'), (snapshot) => {
  const isCleaning = snapshot.val() === true;
  textSps30Status.innerText = isCleaning ? 'Cleaning in progress...' : 'Ready';
  textSps30Status.style.color = isCleaning ? 'var(--accent-yellow)' : '#ffffff';
  btnClean.disabled = isCleaning;
  btnClean.style.opacity = isCleaning ? '0.6' : '1';
});

btnClean?.addEventListener('click', () => {
  cleaningRequestStarted = true;
  modalConfirm.style.display = 'flex';
});

btnModalCancel?.addEventListener('click', () => {
  cleaningRequestStarted = false;
  modalConfirm.style.display = 'none';
});

btnModalConfirm?.addEventListener('click', () => {
  if (!cleaningRequestStarted) return;
  cleaningRequestStarted = false;
  modalConfirm.style.display = 'none';
  update(ref(db, aeroCubePath + '/settings'), { sps30Clean: true })
    .catch(error => {
      console.error('Error triggering SPS30 cleaning:', error);
      textSps30Status.innerText = 'Error sending command';
      textSps30Status.style.color = 'var(--accent-red)';
    });
});

modalConfirm?.addEventListener('click', (event) => {
  if (event.target === modalConfirm) {
    cleaningRequestStarted = false;
    modalConfirm.style.display = 'none';
  }
});

// ============================================================
//  3. UPDATE TEXT INSTANTLY WHEN DRAGGING SLIDERS
// ============================================================
sliderCo2.addEventListener('input', (e) => {
  valCo2.innerHTML = e.target.value + ' <span>ppm</span>';
});
sliderVoc.addEventListener('input', (e) => {
  valVoc.innerHTML = e.target.value + ' <span>idx</span>';
});
sliderPmAqi.addEventListener('input', (e) => {
  valPmAqi.innerHTML = e.target.value + ' <span>AQI</span>';
});

// ============================================================
//  4. SAVE THRESHOLDS TO FIREBASE
// ============================================================
btnSave.addEventListener('click', () => {
  const originalHTML = btnSave.innerHTML;
  btnSave.innerHTML = '<i data-lucide="loader"></i> Saving...';
  btnSave.style.opacity = '0.7';
  if (window.lucide) lucide.createIcons();

  // Write to the exact Firebase paths the firmware reads
  const newSettings = {
    co2Threshold: parseInt(sliderCo2.value),
    vocThreshold: parseInt(sliderVoc.value),
    pmAQIThreshold: parseInt(sliderPmAqi.value),
    co2Outlet: selectCo2Outlet.value,
    vocOutlet: selectVocOutlet.value,
    pmAQIOutlet: selectPmAqiOutlet.value
  };

  update(ref(db, aeroCubePath + '/settings'), newSettings)
    .then(() => {
      btnSave.innerHTML = '<i data-lucide="check"></i> Saved Successfully!';
      btnSave.style.opacity = '1';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => { btnSave.innerHTML = originalHTML; if (window.lucide) lucide.createIcons(); }, 2000);
    })
    .catch((error) => {
      console.error("Error saving settings:", error);
      btnSave.innerHTML = '<i data-lucide="x"></i> Error Saving!';
      btnSave.style.opacity = '1';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => { btnSave.innerHTML = originalHTML; if (window.lucide) lucide.createIcons(); }, 2000);
    });
});

// ============================================================
//  5. BUZZER TOGGLE — WRITE TO CONTROLS
// ============================================================
switchBuzzer?.addEventListener('change', (e) => {
  // checked = ON (enabled) → isBuzzerSilenced = false
  // unchecked = SILENCED → isBuzzerSilenced = true
  update(ref(db, aeroCubePath + '/controls'), { isBuzzerSilenced: !e.target.checked });
});
