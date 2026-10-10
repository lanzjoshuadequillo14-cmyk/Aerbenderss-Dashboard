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

const valCo2 = document.getElementById('val-co2');
const sliderCo2 = document.getElementById('slider-co2');

const valVoc = document.getElementById('val-voc');
const sliderVoc = document.getElementById('slider-voc');

const valPm25 = document.getElementById('val-pm25');
const sliderPm25 = document.getElementById('slider-pm25');

const selectCo2Outlet = document.getElementById('select-co2-outlet');
const selectVocOutlet = document.getElementById('select-voc-outlet');
const selectPm25Outlet = document.getElementById('select-pm25-outlet');

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

const THRESHOLD_STANDARDS = {
  co2: {
    slider: sliderCo2,
    standard: 1000,
    unit: ' ppm',
    name: 'CO₂',
    reference: '<1000 Harmless · 1000–2000 Elevated · >2000 Unacceptable'
  },
  voc: {
    slider: sliderVoc,
    standard: 100,
    unit: '',
    name: 'VOC Index',
    reference: '1–99 Improvement · Around 100 Normal Baseline · 101–500 Deterioration'
  },
  pm25: {
    slider: sliderPm25,
    standard: 15,
    unit: ' µg/m³',
    name: '24-hour PM2.5',
    reference: '≤15 Within WHO 24-hour AQG · >15 Above WHO 24-hour AQG'
  }
};

const savedThresholds = {};

function getThresholdColor(key, value) {
  if (key === 'co2') {
    if (value > 2000) return SLIDER_COLORS.red;
    if (value >= 1000) return SLIDER_COLORS.yellow;
    return SLIDER_COLORS.green;
  }

  if (key === 'voc') {
    if (value > 100) return SLIDER_COLORS.red;
    if (value === 100) return SLIDER_COLORS.yellow;
    return SLIDER_COLORS.green;
  }

  if (key === 'pm25') {
    if (value > 15) return SLIDER_COLORS.red;
    return SLIDER_COLORS.green;
  }

  return SLIDER_COLORS.green;
}

function updateThresholdSliderColor(slider, key) {
  if (!slider) return;

  const value = Number(slider.value);
  const min = Number(slider.min);
  const max = Number(slider.max);
  const percentage = ((value - min) / (max - min)) * 100;
  const color = getThresholdColor(key, value);

  slider.style.setProperty('--slider-color', color);
  slider.style.background =
    `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`;

  refreshThresholdUi(key);
}

function updateAllThresholdSliderColors() {
  Object.keys(THRESHOLD_STANDARDS).forEach(key => {
    updateThresholdSliderColor(THRESHOLD_STANDARDS[key].slider, key);
  });
}

function setSliderValue(key, value) {
  const cfg = THRESHOLD_STANDARDS[key];

  if (!cfg.slider || !Number.isFinite(value)) return;

  const min = Number(cfg.slider.min);
  const max = Number(cfg.slider.max);

  cfg.slider.value = Math.min(max, Math.max(min, Math.round(value)));
  cfg.slider.dispatchEvent(new Event('input', { bubbles: true }));
}

function getReferenceStatus(key, value) {
  if (key === 'co2') {
    if (value < 1000) return 'Harmless';
    if (value <= 2000) return 'Elevated';
    return 'Unacceptable';
  }

  if (key === 'voc') {
    if (value < 100) return 'Improvement';
    if (value === 100) return 'Normal Baseline';
    return 'Deterioration';
  }

  if (key === 'pm25') {
    return value <= 15
      ? 'Within WHO 24-hour AQG'
      : 'Above WHO 24-hour AQG';
  }

  return '';
}

function refreshThresholdUi(key) {
  const cfg = THRESHOLD_STANDARDS[key];

  if (!cfg.slider) return;

  const value = Number(cfg.slider.value);
  const input = document.getElementById('std-input-' + key);

  if (input && document.activeElement !== input) {
    input.value = value;
  }

  const badge = document.getElementById('std-badge-' + key);
  const note = document.getElementById('std-note-' + key);
  const flag = document.getElementById('std-unsaved-' + key);

  if (!badge || !note) return;

  const isStandard = value === cfg.standard;
  const unsaved =
    savedThresholds[key] !== undefined &&
    savedThresholds[key] !== value;

  badge.className = 'std-badge ' + (isStandard ? 'standard' : 'custom');
  badge.textContent = isStandard ? 'Reference' : 'Custom';

  if (flag) {
    flag.textContent = unsaved ? 'Unsaved — press Save' : '';
  }

  note.textContent =
    'Reference status at this value: ' +
    getReferenceStatus(key, value) +
    '.';

  if (key === 'pm25') {
    note.textContent +=
      ' WHO comparison applies to a rolling 24-hour average.';
  }
}

function buildThresholdUi() {
  const style = document.createElement('style');

  style.textContent =
    '.std-slider-wrap{position:relative;padding:6px 0}' +
    '.std-mark{position:absolute;top:2px;bottom:2px;width:2px;margin-left:-1px;background:#fff;border-radius:1px;opacity:.85;pointer-events:none}' +
    '.std-panel{display:flex;flex-direction:column;gap:8px;margin-top:4px}' +
    '.std-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}' +
    '.std-input{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted,#64748b)}' +
    '.std-input input{width:84px;background:var(--bg-main,#0b0f17);border:1px solid var(--border,#1e293b);border-radius:6px;color:#fff;font-size:13px;padding:6px 8px}' +
    '.std-input input:focus{outline:none;border-color:var(--accent-blue,#38bdf8)}' +
    '.std-reset,.std-reset-all{background:transparent;border:1px solid var(--border,#1e293b);border-radius:6px;color:var(--text-sub,#94a3b8);font-size:11px;font-weight:600;padding:6px 10px;cursor:pointer}' +
    '.std-reset:hover,.std-reset-all:hover{border-color:var(--accent-blue,#38bdf8);color:#fff}' +
    '.std-reset-all{padding:10px 14px;font-size:12px;margin-right:8px}' +
    '.std-badge{font-size:10px;font-weight:700;letter-spacing:.6px;padding:3px 8px;border-radius:10px;text-transform:uppercase}' +
    '.std-badge.standard{background:rgba(16,185,129,.15);color:#10b981}' +
    '.std-badge.custom{background:rgba(56,189,248,.15);color:#38bdf8}' +
    '.std-unsaved{font-size:10px;font-weight:600;color:#FACC15}' +
    '.std-note{font-size:11px;line-height:1.5;color:var(--text-sub,#94a3b8)}' +
    '.std-ref{font-size:11px;line-height:1.5;color:var(--text-muted,#64748b)}' +
    '.std-ref b{color:var(--text-sub,#94a3b8)}';

  document.head.appendChild(style);

  Object.keys(THRESHOLD_STANDARDS).forEach(key => {
    const cfg = THRESHOLD_STANDARDS[key];
    const slider = cfg.slider;

    if (!slider || !slider.parentNode) return;

    const min = Number(slider.min);
    const max = Number(slider.max);

    const wrap = document.createElement('div');
    wrap.className = 'std-slider-wrap';

    slider.parentNode.insertBefore(wrap, slider);
    wrap.appendChild(slider);

    const p = Math.min(
      100,
      Math.max(
        0,
        ((cfg.standard - min) / (max - min)) * 100
      )
    );

    wrap.insertAdjacentHTML(
      'beforeend',
      '<span class="std-mark" title="Reference: ' +
      cfg.standard +
      cfg.unit +
      '" style="left:calc(' +
      p +
      '% + ' +
      ((0.5 - p / 100) * 18) +
      'px)"></span>'
    );

    wrap.insertAdjacentHTML(
      'afterend',
      '<div class="std-panel">' +
        '<div class="std-row">' +
          '<label class="std-input">' +
            '<span>Set value</span>' +
            '<input type="number" id="std-input-' +
            key +
            '" min="' +
            min +
            '" max="' +
            max +
            '" step="' +
            (slider.step || 1) +
            '">' +
            '<span>' +
            cfg.unit.trim() +
            '</span>' +
          '</label>' +
          '<button type="button" class="std-reset" id="std-reset-' +
          key +
          '">Use reference (' +
          cfg.standard +
          cfg.unit +
          ')</button>' +
          '<span class="std-badge" id="std-badge-' +
          key +
          '"></span>' +
          '<span class="std-unsaved" id="std-unsaved-' +
          key +
          '"></span>' +
        '</div>' +
        '<div class="std-note" id="std-note-' +
        key +
        '"></div>' +
        '<div class="std-ref"><b>Reference levels:</b> ' +
        cfg.reference +
        '</div>' +
      '</div>'
    );

    const input = document.getElementById('std-input-' + key);

    input.addEventListener('input', () => {
      const value = parseFloat(input.value);

      if (Number.isFinite(value)) {
        setSliderValue(key, value);
      }
    });

    input.addEventListener('change', () => {
      const value = parseFloat(input.value);

      setSliderValue(
        key,
        Number.isFinite(value)
          ? value
          : cfg.standard
      );

      input.value = cfg.slider.value;
    });

    document
      .getElementById('std-reset-' + key)
      .addEventListener('click', () => {
        setSliderValue(key, cfg.standard);
      });
  });

  if (btnSave) {
    const resetAll = document.createElement('button');

    resetAll.type = 'button';
    resetAll.id = 'btn-reset-standards';
    resetAll.className = 'std-reset-all';
    resetAll.textContent = 'Reset all to references';

    resetAll.addEventListener('click', () => {
      Object.keys(THRESHOLD_STANDARDS).forEach(key => {
        setSliderValue(
          key,
          THRESHOLD_STANDARDS[key].standard
        );
      });
    });

    btnSave.parentNode.insertBefore(resetAll, btnSave);
  }
}

buildThresholdUi();

onValue(ref(db, aeroCubePath + '/settings'), snapshot => {
  const settings = snapshot.val();

  if (!settings) return;

  const thresholds = settings.automationThresholds || {};
  const relayAssignments = settings.relayAssignments || {};

  if (thresholds.co2Threshold !== undefined) {
    sliderCo2.value = thresholds.co2Threshold;
    valCo2.innerHTML =
      thresholds.co2Threshold +
      ' <span>ppm</span>';
    savedThresholds.co2 =
      Number(thresholds.co2Threshold);
  }

  if (thresholds.vocThreshold !== undefined) {
    sliderVoc.value = thresholds.vocThreshold;
    valVoc.innerHTML =
      thresholds.vocThreshold +
      ' <span>Index</span>';
    savedThresholds.voc =
      Number(thresholds.vocThreshold);
  }

  if (thresholds.pm25Threshold !== undefined) {
    sliderPm25.value = thresholds.pm25Threshold;
    valPm25.innerHTML =
      thresholds.pm25Threshold +
      ' <span>µg/m³</span>';
    savedThresholds.pm25 =
      Number(thresholds.pm25Threshold);
  }

  updateAllThresholdSliderColors();

  if (relayAssignments.co2 !== undefined) {
    selectCo2Outlet.value = relayAssignments.co2;
  }

  if (relayAssignments.voc !== undefined) {
    selectVocOutlet.value = relayAssignments.voc;
  }

  if (relayAssignments.pm25 !== undefined) {
    selectPm25Outlet.value = relayAssignments.pm25;
  }
});

onValue(
  ref(db, aeroCubePath + '/controls/isBuzzerSilenced'),
  snapshot => {
    const isSilenced = snapshot.val();

    if (
      isSilenced !== undefined &&
      switchBuzzer
    ) {
      switchBuzzer.checked = !isSilenced;
      textBuzzer.innerText =
        isSilenced ? 'SILENCED' : 'ON';
      switchBuzzer.disabled = false;
    }
  }
);

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

sliderCo2.addEventListener('input', e => {
  valCo2.innerHTML =
    e.target.value +
    ' <span>ppm</span>';

  updateThresholdSliderColor(
    sliderCo2,
    'co2'
  );
});

sliderVoc.addEventListener('input', e => {
  valVoc.innerHTML =
    e.target.value +
    ' <span>Index</span>';

  updateThresholdSliderColor(
    sliderVoc,
    'voc'
  );
});

sliderPm25.addEventListener('input', e => {
  valPm25.innerHTML =
    e.target.value +
    ' <span>µg/m³</span>';

  updateThresholdSliderColor(
    sliderPm25,
    'pm25'
  );
});

updateAllThresholdSliderColors();

btnSave.addEventListener('click', () => {
  const originalHTML = btnSave.innerHTML;

  btnSave.innerHTML =
    '<i data-lucide="loader"></i> Saving...';

  btnSave.style.opacity = '0.7';

  if (window.lucide) {
    lucide.createIcons();
  }

  const newSettings = {
    automationThresholds: {
      co2Threshold: parseInt(sliderCo2.value),
      vocThreshold: parseInt(sliderVoc.value),
      pm25Threshold: parseInt(sliderPm25.value)
    },
    relayAssignments: {
      co2: selectCo2Outlet.value,
      voc: selectVocOutlet.value,
      pm25: selectPm25Outlet.value
    }
  };

  update(
    ref(db, aeroCubePath + '/settings'),
    newSettings
  )
    .then(() => {
      savedThresholds.co2 =
        newSettings.automationThresholds.co2Threshold;

      savedThresholds.voc =
        newSettings.automationThresholds.vocThreshold;

      savedThresholds.pm25 =
        newSettings.automationThresholds.pm25Threshold;

      updateAllThresholdSliderColors();

      btnSave.innerHTML =
        '<i data-lucide="check"></i> Saved Successfully!';

      btnSave.style.opacity = '1';

      if (window.lucide) {
        lucide.createIcons();
      }

      setTimeout(() => {
        btnSave.innerHTML = originalHTML;

        if (window.lucide) {
          lucide.createIcons();
        }
      }, 2000);
    })
    .catch(error => {
      console.error(
        'Error saving settings:',
        error
      );

      btnSave.innerHTML =
        '<i data-lucide="x"></i> Error Saving!';

      btnSave.style.opacity = '1';

      if (window.lucide) {
        lucide.createIcons();
      }

      setTimeout(() => {
        btnSave.innerHTML = originalHTML;

        if (window.lucide) {
          lucide.createIcons();
        }
      }, 2000);
    });
});

switchBuzzer?.addEventListener('change', e => {
  update(
    ref(db, aeroCubePath + '/controls'),
    {
      isBuzzerSilenced:
        !e.target.checked
    }
  );
});