import { db, auth, BASE_PATH } from './firebase.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, user => {
  if (!user) window.location.href = 'Registration.html';
});

document.getElementById('btn-logout')?.addEventListener('click', async e => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = 'Registration.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
});

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

deviceSelectorForm?.addEventListener('submit', e => {
  e.preventDefault();

  const cubeId = aerocubeIdInput.value.trim();
  const plugId = aeroplugIdInput.value.trim();
  const validId = /^[A-Za-z0-9_-]+$/;

  if (!validId.test(cubeId) || !validId.test(plugId)) return;

  localStorage.setItem('aerocube-id', cubeId);
  localStorage.setItem('aeroplug-id', plugId);
  window.location.reload();
});

menuToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
});

overlay?.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

// Threshold drafts are settings only; AeroCube calculates all relay outputs.
const btnSave = document.getElementById('btn-save');
const thresholdsPath = aeroCubePath + '/settings/automationThresholds';
const thresholdFields = {
  co2: { field: 'co2Threshold', reference: 1000, unit: 'ppm' },
  voc: { field: 'vocThreshold', reference: 150, unit: 'Index' },
  pm25: { field: 'pm2p5Threshold', reference: 35, unit: 'µg/m³' }
};
const dirtyThresholds = new Set();
const pendingThresholds = new Set();

const deviceNote = document.getElementById('device-selection-note');
if (deviceNote) {
  deviceNote.textContent = 'Selected AeroCube: ' + savedAeroCubeId +
    '. Current firmware uses aerocube_01.' +
    (savedAeroCubeId === 'aerocube_01' ? '' : ' Select aerocube_01 above to configure this firmware.');
}

function readThreshold(input) {
  const raw = input.value.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function formatThreshold(value) {
  // Remove binary floating-point noise from read-only helper text only.
  return Number(value.toPrecision(12)).toString();
}

function setThresholdFeedback(key, message, state = '') {
  const feedback = document.getElementById('std-feedback-' + key);
  feedback.textContent = message;
  feedback.className = 'control-feedback' + (state ? ' ' + state : '');
}

function refreshThresholdUi(key) {
  const cfg = thresholdFields[key];
  const value = readThreshold(cfg.input);
  const display = document.getElementById('val-' + key);
  display.textContent = value === null ? '-- ' : formatThreshold(value) + ' ';
  const unit = document.createElement('span');
  unit.textContent = cfg.unit;
  display.appendChild(unit);

  document.getElementById('std-release-' + key).textContent = value === null
    ? 'Enter a positive whole-number threshold to see its release point (fixed 15% hysteresis).'
    : 'Activates at ≥' + formatThreshold(value) + ' ' + cfg.unit +
      '; clears below ' + formatThreshold(value * 0.85) + ' ' + cfg.unit + '.';
  document.getElementById('std-unsaved-' + key).textContent = dirtyThresholds.has(key)
    ? 'Unsaved — press Save' : '';

  const slider = cfg.slider;
  // The number input is authoritative. A slider must never clamp/round a typed
  // or saved value; values outside its convenience range stay in the input.
  const inRange = value !== null && value >= Number(slider.min) && value <= Number(slider.max);
  if (inRange) slider.value = value;
  slider.classList.toggle('threshold-slider-unset', !inRange);
  const percentage = inRange
    ? ((value - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100
    : 0;
  let color = '#10b981';
  if ((key === 'co2' && value > 2000) || (key === 'pm25' && value > 35)) color = '#ef4444';
  else if ((key === 'co2' && value >= 1000) || (key === 'voc' && value > 100)) color = '#FACC15';
  slider.style.setProperty('--slider-color', color);
  slider.style.background = 'linear-gradient(to right, ' + color + ' 0%, ' + color + ' ' +
    percentage + '%, var(--border) ' + percentage + '%, var(--border) 100%)';
}

function editThreshold(key) {
  dirtyThresholds.add(key);
  thresholdFields[key].input.removeAttribute('aria-invalid');
  setThresholdFeedback(key, '');
  refreshThresholdUi(key);
}

async function saveThreshold(key) {
  const cfg = thresholdFields[key];
  if (pendingThresholds.has(key)) return;
  const value = readThreshold(cfg.input);
  dirtyThresholds.add(key);
  if (value === null) {
    cfg.input.setAttribute('aria-invalid', 'true');
    setThresholdFeedback(key, 'Enter a whole number greater than zero. Nothing saved.', 'error');
    refreshThresholdUi(key);
    return;
  }

  pendingThresholds.add(key);
  cfg.save.disabled = true;
  // Keep the draft stable while this field's Firebase write is pending.
  cfg.input.disabled = true;
  cfg.slider.disabled = true;
  cfg.reset.disabled = true;
  cfg.input.removeAttribute('aria-invalid');
  setThresholdFeedback(key, 'Saving to Firebase…');
  try {
    // A one-field update preserves all other thresholds and settings. Never
    // change the mode or write AeroPlug commands from a settings save.
    await update(ref(db, thresholdsPath), { [cfg.field]: value });
    dirtyThresholds.delete(key);
    setThresholdFeedback(key, 'Saved to Firebase. AeroCube will apply this setting.', 'success');
  } catch (error) {
    console.error('Error saving ' + cfg.field + ':', error);
    setThresholdFeedback(key, 'Could not save to Firebase. Your draft is kept; try again.', 'error');
  } finally {
    pendingThresholds.delete(key);
    cfg.save.disabled = false;
    cfg.input.disabled = false;
    cfg.slider.disabled = false;
    cfg.reset.disabled = false;
    refreshThresholdUi(key);
  }
}

Object.entries(thresholdFields).forEach(([key, cfg]) => {
  cfg.input = document.getElementById('std-input-' + key);
  cfg.slider = document.getElementById('slider-' + key);
  cfg.save = document.getElementById('std-save-' + key);
  cfg.reset = document.getElementById('std-reset-' + key);
  cfg.input.addEventListener('input', () => editThreshold(key));
  cfg.slider.addEventListener('input', () => {
    cfg.input.value = cfg.slider.value;
    editThreshold(key);
  });
  cfg.reset.addEventListener('click', () => {
    // Choosing a reference only edits the draft; Save is still required.
    cfg.input.value = cfg.reference;
    editThreshold(key);
  });
  cfg.save.addEventListener('click', () => saveThreshold(key));
  refreshThresholdUi(key);
});

onValue(ref(db, thresholdsPath), snapshot => {
  const thresholds = snapshot.val() || {};
  Object.entries(thresholdFields).forEach(([key, cfg]) => {
    const saved = thresholds[cfg.field];
    const value = (typeof saved === 'number' || (typeof saved === 'string' && saved.trim()))
      ? Number(saved) : NaN;
    const loadable = Number.isFinite(value) && value > 0;
    const valid = Number.isSafeInteger(value) && value > 0;
    // Updates for another field (or a local pending write) must not replace
    // this field's unsaved/invalid draft or falsely confirm a Firebase save.
    if (!dirtyThresholds.has(key) && !pendingThresholds.has(key)) {
      // Keep an older decimal visible for correction; never round or rewrite it.
      cfg.input.value = loadable ? value : '';
      cfg.input.removeAttribute('aria-invalid');
      if (loadable && !valid) cfg.input.setAttribute('aria-invalid', 'true');
      setThresholdFeedback(key, valid ? '' : loadable
        ? 'Saved threshold must be a positive whole number. Enter a whole number and save.'
        : 'No valid saved value. Enter a whole number and save.', loadable && !valid ? 'error' : '');
    }
    refreshThresholdUi(key);
  });
}, error => {
  console.error('Error loading automation thresholds:', error);
  Object.keys(thresholdFields).forEach(key => {
    setThresholdFeedback(key, 'Could not load this threshold from Firebase.', 'error');
  });
});

btnSave.addEventListener('click', async () => {
  btnSave.disabled = true;
  try {
    // Each save validates and reports independently; invalid PM2.5 never
    // prevents a valid CO2 or VOC write, even when using Save Thresholds.
    await Promise.all(Object.keys(thresholdFields).map(saveThreshold));
  } finally {
    btnSave.disabled = false;
  }
});

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

onValue(
  ref(db, aeroCubePath + '/settings/maintenance/SPS30Clean'),
  snapshot => {
    const isCleaning =
      snapshot.val() === true;

    textSps30Status.innerText =
      isCleaning
        ? 'Cleaning in progress...'
        : 'Ready';

    textSps30Status.style.color =
      isCleaning
        ? 'var(--accent-yellow)'
        : '#ffffff';

    btnClean.disabled = isCleaning;
    btnClean.style.opacity =
      isCleaning ? '0.6' : '1';
  }
);

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

  update(
    ref(db, aeroCubePath + '/settings/maintenance'),
    { SPS30Clean: true }
  ).catch(error => {
    console.error(
      'Error triggering SPS30 cleaning:',
      error
    );

    textSps30Status.innerText =
      'Error sending command';

    textSps30Status.style.color =
      'var(--accent-red)';
  });
});

modalConfirm?.addEventListener('click', event => {
  if (event.target === modalConfirm) {
    cleaningRequestStarted = false;
    modalConfirm.style.display = 'none';
  }
});

onValue(
  ref(db, aeroCubePath + '/settings/maintenance/co2FRC'),
  snapshot => {
    const isCalibrating =
      snapshot.val() === true;

    textCo2FrcStatus.innerText =
      isCalibrating
        ? 'Calibration in progress...'
        : 'Ready';

    textCo2FrcStatus.style.color =
      isCalibrating
        ? 'var(--accent-yellow)'
        : '#ffffff';

    btnCo2Frc.disabled = isCalibrating;
    btnCo2Frc.style.opacity =
      isCalibrating ? '0.6' : '1';
  }
);

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

  update(
    ref(db, aeroCubePath + '/settings/maintenance'),
    { co2FRC: true }
  )
    .then(() => {
      textCo2FrcStatus.innerText =
        'Calibration command sent!';

      textCo2FrcStatus.style.color =
        'var(--accent-green)';
    })
    .catch(error => {
      console.error(
        'Error triggering SCD41 CO₂ recalibration:',
        error
      );

      textCo2FrcStatus.innerText =
        'Error sending command';

      textCo2FrcStatus.style.color =
        'var(--accent-red)';
    });
});

modalCo2FrcConfirm?.addEventListener('click', event => {
  if (event.target === modalCo2FrcConfirm) {
    co2FrcRequestStarted = false;
    modalCo2FrcConfirm.style.display = 'none';
  }
});

