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
const btnCo2Frc = document.getElementById('btn-co2frc');
const textCo2FrcStatus = document.getElementById('text-co2frc-status');
const modalCo2FrcConfirm = document.getElementById('modal-co2frc-confirm');
const btnCo2FrcCancel = document.getElementById('btn-co2frc-cancel');
const btnCo2FrcConfirm = document.getElementById('btn-co2frc-confirm');
let cleaningRequestStarted = false;
let co2FrcRequestStarted = false;

const SLIDER_COLORS = {
  green: '#10b981',
  yellow: '#FACC15',
  red: '#ef4444'
};

function updateThresholdSliderColor(slider, elevatedAt, poorAt) {
  if (!slider) return;

  const value = Number(slider.value);
  const min = Number(slider.min);
  const max = Number(slider.max);
  const percentage = ((value - min) / (max - min)) * 100;
  const color = value >= poorAt
    ? SLIDER_COLORS.red
    : value >= elevatedAt
      ? SLIDER_COLORS.yellow
      : SLIDER_COLORS.green;

  slider.style.setProperty('--slider-color', color);
  slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`;
}

function updateAllThresholdSliderColors() {
  updateThresholdSliderColor(sliderCo2, 1000, 1500);
  updateThresholdSliderColor(sliderVoc, 150, 250);
  updateThresholdSliderColor(sliderPmAqi, 101, 151);
}

// ============================================================
//  1. FETCH LIVE SETTINGS FROM FIREBASE
// ============================================================
onValue(ref(db, aeroCubePath + '/settings'), (snapshot) => {
  const settings = snapshot.val();
  if (!settings) return;

  // Update threshold sliders from Firebase values
  const thresholds = settings.automationThresholds || {};
  const relayAssignments = settings.relayAssignments || {};

  if (thresholds.co2Threshold !== undefined) {
    sliderCo2.value = thresholds.co2Threshold;
    valCo2.innerHTML = thresholds.co2Threshold + ' <span>ppm</span>';
  }
  if (thresholds.vocThreshold !== undefined) {
    sliderVoc.value = thresholds.vocThreshold;
    valVoc.innerHTML = thresholds.vocThreshold + ' <span>idx</span>';
  }
  if (thresholds.pmAQIThreshold !== undefined) {
    sliderPmAqi.value = thresholds.pmAQIThreshold;
    valPmAqi.innerHTML = thresholds.pmAQIThreshold + ' <span>AQI</span>';
  }
  updateAllThresholdSliderColors();
  if (relayAssignments.co2 !== undefined) selectCo2Outlet.value = relayAssignments.co2;
  if (relayAssignments.voc !== undefined) selectVocOutlet.value = relayAssignments.voc;
  if (relayAssignments.pmAQI !== undefined) selectPmAqiOutlet.value = relayAssignments.pmAQI;
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

onValue(ref(db, aeroCubePath + '/settings/maintenance/SPS30Clean'), (snapshot) => {
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
  update(ref(db, aeroCubePath + '/settings/maintenance'), { SPS30Clean: true })
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

onValue(ref(db, aeroCubePath + '/settings/maintenance/co2FRC'), (snapshot) => {
  const isCalibrating = snapshot.val() === true;
  textCo2FrcStatus.innerText = isCalibrating ? 'Calibration in progress...' : 'Ready';
  textCo2FrcStatus.style.color = isCalibrating ? 'var(--accent-yellow)' : '#ffffff';
  btnCo2Frc.disabled = isCalibrating;
  btnCo2Frc.style.opacity = isCalibrating ? '0.6' : '1';
});

btnCo2Frc?.addEventListener('click', () => {
  co2FrcRequestStarted = true;
  modalCo2FrcConfirm.style.display = 'flex';
});

btnCo2FrcCancel?.addEventListener('click', () => {
  co2FrcRequestStarted = false;
  modalCo2FrcConfirm.style.display = 'none';
});

btnCo2FrcConfirm?.addEventListener('click', () => {
  if (!co2FrcRequestStarted) return;
  co2FrcRequestStarted = false;
  modalCo2FrcConfirm.style.display = 'none';

  update(ref(db, aeroCubePath + '/settings/maintenance'), { co2FRC: true })
    .then(() => {
      textCo2FrcStatus.innerText = 'Calibration command sent!';
      textCo2FrcStatus.style.color = 'var(--accent-green)';
    })
    .catch((error) => {
      console.error('Error triggering SCD41 CO2 recalibration:', error);
      textCo2FrcStatus.innerText = 'Error sending command';
      textCo2FrcStatus.style.color = 'var(--accent-red)';
    });
});

modalCo2FrcConfirm?.addEventListener('click', (event) => {
  if (event.target === modalCo2FrcConfirm) {
    co2FrcRequestStarted = false;
    modalCo2FrcConfirm.style.display = 'none';
  }
});

// ============================================================
//  3. UPDATE TEXT INSTANTLY WHEN DRAGGING SLIDERS
// ============================================================
sliderCo2.addEventListener('input', (e) => {
  valCo2.innerHTML = e.target.value + ' <span>ppm</span>';
  updateThresholdSliderColor(sliderCo2, 1000, 1500);
});
sliderVoc.addEventListener('input', (e) => {
  valVoc.innerHTML = e.target.value + ' <span>idx</span>';
  updateThresholdSliderColor(sliderVoc, 150, 250);
});
sliderPmAqi.addEventListener('input', (e) => {
  valPmAqi.innerHTML = e.target.value + ' <span>AQI</span>';
  updateThresholdSliderColor(sliderPmAqi, 101, 151);
});
updateAllThresholdSliderColors();

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
    automationThresholds: {
      co2Threshold: parseInt(sliderCo2.value),
      vocThreshold: parseInt(sliderVoc.value),
      pmAQIThreshold: parseInt(sliderPmAqi.value)
    },
    relayAssignments: {
      co2: selectCo2Outlet.value,
      voc: selectVocOutlet.value,
      pmAQI: selectPmAqiOutlet.value
    }
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
