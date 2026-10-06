// ============================================================
//  script.js — AeroCube Dashboard main logic
//  Imports shared Firebase config from firebase.js
// ============================================================

import { db, auth, BASE_PATH } from './firebase.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'Registration.html';
  }
});

// --- LOGOUT ---
document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = 'Registration.html';
  } catch (err) {
    console.error("Logout error:", err);
  }
});

// --- MOBILE MENU TOGGLE ---
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

const savedAeroCubeId = localStorage.getItem('aerocube-id') || BASE_PATH.split('/').pop();
const aeroCubePath = '/Aerocubes/' + savedAeroCubeId;

const deviceSelectorForm = document.getElementById('device-selector-form');
const aerocubeIdInput = document.getElementById('aerocube-id');
const deviceName = document.getElementById('device-name');

if (aerocubeIdInput) aerocubeIdInput.value = savedAeroCubeId;
if (deviceName) deviceName.innerText = savedAeroCubeId;

deviceSelectorForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const cubeId = aerocubeIdInput.value.trim();
  const validId = /^[A-Za-z0-9_-]+$/;
  if (!validId.test(cubeId)) return;
  localStorage.setItem('aerocube-id', cubeId);
  window.location.reload();
});

function toggleMenu() {
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
}
menuToggle?.addEventListener('click', toggleMenu);
overlay?.addEventListener('click', toggleMenu);

// Close the mobile drawer on link tap, Escape, or resize to desktop
sidebar?.querySelectorAll('a.nav-item').forEach(link => {
  link.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) toggleMenu();
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar?.classList.contains('open')) toggleMenu();
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 768 && sidebar?.classList.contains('open')) toggleMenu();
});

// ============================================================
//  DOM ELEMENT REFERENCES
// ============================================================
const valCo2 = document.getElementById('val-co2');
const valPm25 = document.getElementById('val-pm25');
const valPmAqi = document.getElementById('val-pmaqi');
const valVoc = document.getElementById('val-voc');
const valPm10 = document.getElementById('val-pm10');
const valTemp = document.getElementById('val-temp');
const valHumidity = document.getElementById('val-humidity');
const valPm1 = document.getElementById('val-pm1');
const valPm4 = document.getElementById('val-pm4');

const statusCo2 = document.getElementById('status-co2');
const statusPm25 = document.getElementById('status-pm25');
const statusPmAqi = document.getElementById('status-pmaqi');
const statusVoc = document.getElementById('status-voc');
const statusPm10 = document.getElementById('status-pm10');

const aqBanner = document.getElementById('aq-banner');
const aqBannerStatus = document.getElementById('aq-banner-status');
const aqBannerDesc = document.getElementById('aq-banner-desc');

const deviceIndicator = document.getElementById('device-indicator');
const deviceLastSeen = document.getElementById('device-last-seen');
const deviceConnBadge = document.getElementById('device-connection-badge');
const deviceStatusText = document.getElementById('device-status-text');

const switchBuzzer = document.getElementById('switch-buzzer');
const textBuzzer = document.getElementById('text-buzzer');
const notificationButton = document.getElementById('btn-notifications');

const recContent = document.getElementById('recommendations-content');
const notificationStates = {};
let previousConnectionState = null;
let firstReadingHandled = false;   // true once the first reading after load/reconnect is announced

function updateNotificationButton() {
  if (!notificationButton || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    notificationButton.classList.add('enabled');
    notificationButton.classList.remove('denied');
    notificationButton.innerHTML = '<i data-lucide="bell-ring"></i><span>Notifications Enabled</span>';
  } else if (Notification.permission === 'denied') {
    notificationButton.classList.add('denied');
    notificationButton.classList.remove('enabled');
    notificationButton.innerHTML = '<i data-lucide="bell-off"></i><span>Notifications Blocked</span>';
  }
  if (window.lucide) lucide.createIcons();
}

// ---- Alert settings ----
const ALERT_REMINDER_MS = 5 * 60 * 1000;   // repeat the alert every 5 min while still POOR
const ALERT_STATES = {                      // which states send a notification
  good: true,
  elevated: true,
  poor: true
};
const ALERT_ON_FIRST_GOOD = false;          // true = also alert "GOOD" on first load / reconnect
const USE_FIREBASE_RECOMMENDATIONS = false; // false = use the words written below in ALERT_INFO
                                            // true  = use the wording from Firebase settings instead
const ALERT_GOOD_SUMMARY = 'Keep up your normal ventilation.';  // shown in the first-load GOOD message
const alertLastSent = {};

// ------------------------------------------------------------
//  HOW THE ALERTS READ
//
//  Example for CO₂ at 1200 ppm:
//
//    CO₂ is elevated - the air is getting stuffy
//    CO₂ is now 1200 ppm.
//    Elevated means 1000 to 1499 ppm.
//    What to do: Open a window or turn on ventilation.
//
//  What each metric means in plain words:
//
//    Metric | Good                           | Elevated                                    | Poor
//    -------|--------------------------------|---------------------------------------------|---------------------------------------------
//    CO₂    | the air is fresh               | the air is getting stuffy                   | the air is very stuffy
//    VOC    | no strong fumes in the air     | there are fumes or strong smells in the air | there are a lot of fumes in the air
//    PM AQI | little dust or smoke in the air| there is some dust or smoke in the air      | there is a lot of dust or smoke in the air
//
//  Each state also has a short recommendation (the "action" below):
//    Good     -> keep it up, e.g. "Air is fresh. Keep ventilating as usual."
//    Elevated -> a specific action, e.g. "Open a window or turn on ventilation."
//    Poor     -> an urgent action, e.g. "Open windows and doors now." (CO₂)
//
//  To change any wording, edit "meaning", "action" or "ranges" below.
// ------------------------------------------------------------
// Plain-language wording for each alert.
// "ranges" matches the "Reading the measurements" table on the dashboard.
const ALERT_INFO = {
  co2: {
    name: 'CO₂',
    ranges: { good: 'below 1000 ppm', elevated: '1000 to 1499 ppm', poor: '1500 ppm or more' },
    meaning: {
      good: 'the air is fresh',
      elevated: 'the air is getting stuffy',
      poor: 'the air is very stuffy'
    },
    action: {
      good: 'Air is fresh. Keep ventilating as usual.',
      elevated: 'Open a window or turn on ventilation.',
      poor: 'Open windows and doors now.'
    }
  },
  voc: {
    name: 'VOC',
    ranges: { good: 'below 150', elevated: '150 to 249', poor: '250 or more' },
    meaning: {
      good: 'no strong fumes in the air',
      elevated: 'there are fumes or strong smells in the air',
      poor: 'there are a lot of fumes in the air'
    },
    action: {
      good: 'No strong fumes. Keep ventilating as usual.',
      elevated: 'Avoid sprays, paint and strong cleaners. Let fresh air in.',
      poor: 'Stop using sprays or cleaners, and open windows now.'
    }
  },
  pmaqi: {
    name: 'PM AQI',
    ranges: { good: '0 to 100', elevated: '101 to 150', poor: '151 or more' },
    meaning: {
      good: 'little dust or smoke in the air',
      elevated: 'there is some dust or smoke in the air',
      poor: 'there is a lot of dust or smoke in the air'
    },
    action: {
      good: 'Air is clean. Keep ventilating as usual.',
      elevated: 'Cut down dust and smoke. Use an air filter if you have one.',
      poor: 'Remove the smoke or dust source and run an air filter.'
    }
  }
};

const ALERT_WORDS = {
  good: 'good',
  elevated: 'elevated',
  poor: 'poor'
};

// Recommendation words shown in each alert ("What to do").
// Uses the words written in ALERT_INFO above. If USE_FIREBASE_RECOMMENDATIONS
// is true, the wording from Firebase settings is used instead.
function getAdvice(metricKey, state) {
  if (USE_FIREBASE_RECOMMENDATIONS) {
    const rec = state === 'good'
      ? recommendationSettings.good
      : (recommendationSettings[metricKey] || {})[state];
    if (rec && rec.text) return rec.text;
  }
  return ALERT_INFO[metricKey].action[state];
}

// In-page popup (works even when system notifications are blocked)
function showToast(title, body, state = 'poor') {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + state;
  const h = document.createElement('strong');
  const p = document.createElement('p');
  h.textContent = title;
  p.textContent = body;
  toast.append(h, p);
  stack.appendChild(toast);
  const close = () => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); };
  toast.addEventListener('click', close);
  setTimeout(close, 9000);
}

// System notification. Uses the service worker so it also works on mobile.
async function showSystemNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    tag,
    renotify: true,
    icon: 'logo/aerocube%20logo.png',
    vibrate: [200, 100, 200]
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), 1500))
      ]);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (err) {
    console.warn('Notification failed:', err);
  }
}

async function sendNotification(title, body, tag = 'aerocube-alert', state = 'poor') {
  showToast(title, body, state);
  if (state === 'poor' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  await showSystemNotification(title, body, tag);
}

notificationButton?.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    window.alert('This browser does not support notifications. On iPhone, add the app to your Home Screen first (iOS 16.4+).');
    return;
  }
  if (Notification.permission === 'default') await Notification.requestPermission();
  updateNotificationButton();

  if (Notification.permission === 'granted') {
    sendNotification(
      'AeroCube notifications are on',
      'You will be alerted when CO₂, VOC or PM AQI changes between good, reaches the limit, or becomes poor.',
      'aerocube-test',
      'good'
    );
  } else if (Notification.permission === 'denied') {
    window.alert('Notifications are blocked. Allow them in your browser or site settings, then reload the page.');
  }
});
updateNotificationButton();

// ============================================================
//  THRESHOLDS (kept in sync with the Indoor Air Quality Guide)
//    CO2     good < 1000   | elevated 1000–1499 | poor 1500+
//    VOC     good < 150    | elevated 150–249   | poor 250+
//    PM AQI  good 0–100    | elevated 101–150   | poor 151+
// ============================================================
const THRESHOLDS = {
  co2:   { elevated: 1000, poor: 1500 },
  voc:   { elevated: 150,  poor: 250 },
  pmaqi: { elevated: 101,  poor: 151 }
};

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

// Set card border + status pill color based on state
function setCardVisual(cardId, state) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.remove('border-good', 'border-elevated', 'border-poor');
  if (state) card.classList.add('border-' + state);
}

function setStatusPill(element, state, label) {
  if (!element) return;
  element.className = 'card-status ' + (state || '');
  element.innerText = label;
}

// Determine CO2 status from value
function getCo2Status(co2) {
  if (co2 >= THRESHOLDS.co2.poor) return { state: 'poor', label: 'POOR' };
  if (co2 >= THRESHOLDS.co2.elevated) return { state: 'elevated', label: 'ELEVATED' };
  return { state: 'good', label: 'NORMAL' };
}

// Determine PM2.5 status
function getPm25Status(pm25) {
  if (pm25 >= 35) return { state: 'poor', label: 'POOR' };
  if (pm25 >= 12) return { state: 'elevated', label: 'ELEVATED' };
  return { state: 'good', label: 'GOOD' };
}

// Determine PM10 status
function getPm10Status(pm10) {
  if (pm10 >= 50) return { state: 'poor', label: 'POOR' };
  if (pm10 >= 25) return { state: 'elevated', label: 'ELEVATED' };
  return { state: 'good', label: 'GOOD' };
}

// Determine PM AQI status from firmware value
function getPmAqiStatus(aqi) {
  if (aqi >= THRESHOLDS.pmaqi.poor) return { state: 'poor', label: 'POOR' };
  if (aqi >= THRESHOLDS.pmaqi.elevated) return { state: 'elevated', label: 'ELEVATED' };
  return { state: 'good', label: 'GOOD' };
}

// Determine VOC status
function getVocStatus(voc) {
  if (voc >= THRESHOLDS.voc.poor) return { state: 'poor', label: 'POOR' };
  if (voc >= THRESHOLDS.voc.elevated) return { state: 'elevated', label: 'ELEVATED' };
  return { state: 'good', label: 'NORMAL' };
}

// Map firmware airQualityStatus to banner state + description
function getAirQualityBannerInfo(statusStr) {
  const s = (statusStr || '').toUpperCase();
  if (s === 'GOOD') {
    return {
      state: 'good',
      label: 'GOOD',
      desc: 'All monitored parameters are currently within the defined thresholds.'
    };
  }
  if (s === 'ELEVATED') {
    return {
      state: 'elevated',
      label: 'ELEVATED',
      desc: 'One or more monitored parameters have exceeded the elevated threshold.'
    };
  }
  if (s === 'POOR') {
    return {
      state: 'poor',
      label: 'POOR',
      desc: 'One or more monitored parameters have reached the poor-air-quality threshold.'
    };
  }
  return { state: null, label: '--', desc: 'Awaiting data from AeroCube device...' };
}

// Check if device is online based on lastSeen timestamp (within 60 seconds)
function checkDeviceOnline(lastSeen) {
  if (!lastSeen) return false;
  const now = Date.now();
  const diffSeconds = Math.floor((now - lastSeen) / 1000);
  return diffSeconds < 60;
}

// Format "time ago" text
function timeAgo(timestamp) {
  if (!timestamp) return '--';
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) return diff + ' seconds ago';
  if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
  return Math.floor(diff / 86400) + ' days ago';
}

function clearStaleSensorData() {
  firstReadingHandled = false;
  notificationStates.co2 = null;
  notificationStates.voc = null;
  notificationStates.pmaqi = null;
  valCo2.innerHTML = '-- <span>ppm</span>';
  valPm25.innerHTML = '-- <span>µg/m³</span>';
  valPmAqi.innerHTML = '-- <span>AQI</span>';
  valVoc.innerText = '--';
  valPm10.innerHTML = '-- <span>µg/m³</span>';
  valTemp.innerHTML = '-- <span>°C</span>';
  valHumidity.innerHTML = '-- <span>%</span>';
  valPm1.innerHTML = '-- <span>µg/m³</span>';
  valPm4.innerHTML = '-- <span>µg/m³</span>';

  [
    ['status-co2', 'No data'],
    ['status-pm25', 'No data'],
    ['status-pmaqi', 'No data'],
    ['status-voc', 'No data'],
    ['status-pm10', 'No data']
  ].forEach(([statusId, label]) => setStatusPill(document.getElementById(statusId), '', label));

  ['card-co2', 'card-pm25', 'card-pmaqi', 'card-voc', 'card-pm10'].forEach(cardId => setCardVisual(cardId, null));
  aqBanner.className = 'aq-status-banner';
  aqBannerStatus.innerText = 'NO DATA';
  aqBannerDesc.innerText = 'Waiting for data from AeroCube device...';
  recContent.innerHTML = '<p class="rec-waiting">Waiting for telemetry data...</p>';
}

function updateDeviceConnectionStatus(lastSeen) {
  const online = checkDeviceOnline(lastSeen);
  deviceLastSeen.innerText = lastSeen
    ? 'Last data received: ' + timeAgo(lastSeen)
    : 'Last data received: --';
  deviceIndicator.className = 'device-indicator ' + (online ? 'connected' : 'disconnected');
  deviceConnBadge.className = 'badge badge-device ' + (online ? 'online' : 'offline');
  deviceStatusText.innerText = online ? 'CONNECTED' : 'DISCONNECTED';
  if (previousConnectionState !== null && previousConnectionState !== online) {
    sendNotification(
      online ? 'AeroCube connected' : 'AeroCube disconnected',
      online ? 'Live sensor data has resumed.' : 'No sensor data has been received for over 60 seconds.',
      'aerocube-connection',
      online ? 'good' : 'poor'
    );
  }
  previousConnectionState = online;
  if (!online) clearStaleSensorData();
}

// Sends a plain-language alert whenever a metric changes to GOOD, ELEVATED or POOR,
// and repeats a reminder while it stays POOR.
function notifyMetricState(metricKey, state, value) {
  const info = ALERT_INFO[metricKey];
  const now = Date.now();
  const prev = notificationStates[metricKey];
  notificationStates[metricKey] = state;

  // Same state as before: only remind while POOR
  if (prev === state) {
    if (state === 'poor' && ALERT_STATES.poor &&
        now - (alertLastSent[metricKey] || 0) >= ALERT_REMINDER_MS) {
      alertLastSent[metricKey] = now;
      sendNotification(
        info.name + ' is still poor - ' + info.meaning.poor,
        info.name + ' is ' + value + '.\n' + getAdvice(metricKey, 'poor'),
        'aerocube-' + metricKey,
        'poor'
      );
    }
    return;
  }

  // First reading after page load or reconnect: skip a plain GOOD
  if (!prev && state === 'good' && !ALERT_ON_FIRST_GOOD) return;
  if (!ALERT_STATES[state]) return;

  alertLastSent[metricKey] = now;

  const range = info.ranges[state];
  const word = ALERT_WORDS[state];
  const advice = getAdvice(metricKey, state);
  const todo = state === 'good' ? advice : 'What to do: ' + advice;
  let title;
  let body;

  if (state === 'elevated' && prev === 'poor') {
    title = info.name + ' is getting better';
    body = info.name + ' is now ' + value + ', down from poor.\n' +
           'It is still elevated (' + range + ').\n' + todo;
  } else {
    title = info.name + ' is ' + word + ' - ' + info.meaning[state];
    body = info.name + ' is now ' + value + '.\n' +
           word.charAt(0).toUpperCase() + word.slice(1) + ' means ' + range + '.\n' + todo;
  }

  sendNotification(title, body, 'aerocube-' + metricKey, state);
}

// First reading after page load or reconnect: if everything is good,
// show ONE friendly message (instead of one per metric).
// If any metric is elevated or poor, those alerts already fired above.
function announceFirstReading() {
  if (firstReadingHandled) return;
  const states = ['co2', 'voc', 'pmaqi'].map(k => notificationStates[k]).filter(Boolean);
  if (states.length === 0) return;
  firstReadingHandled = true;
  if (!ALERT_STATES.good) return;
  if (states.every(st => st === 'good')) {
    sendNotification(
      'Air quality is good',
      'CO₂, VOC and PM AQI are all in the good range.\n' +
        (USE_FIREBASE_RECOMMENDATIONS ? recommendationSettings.good.text : ALERT_GOOD_SUMMARY),
      'aerocube-summary',
      'good'
    );
  }
}

// ------------------------------------------------------------
//  TEST HELPER (no device needed)
//  Open the browser console (F12) and type, for example:
//    aeroTest('co2', 500)    aeroTest('co2', 1200)    aeroTest('co2', 1600)
//    aeroTest('voc', 160)    aeroTest('pmaqi', 120)
//  It sends the same alert a real reading would.
//  Note: the very first "good" reading is skipped on purpose, so test with
//  an elevated value first, then a good one.
// ------------------------------------------------------------
window.aeroTest = function (metric, value) {
  const getters = { co2: getCo2Status, voc: getVocStatus, pmaqi: getPmAqiStatus };
  if (!getters[metric] || typeof value !== 'number') {
    console.log("Use: aeroTest('co2' | 'voc' | 'pmaqi', number)");
    return;
  }
  const s = getters[metric](value);
  notifyMetricState(metric, s.state, metric === 'co2' ? value + ' ppm' : value);
  console.log(metric, value, '->', s.state);
};

// Round long sensor decimals for display only
const fmt = (v, d = 1) => (typeof v === 'number' ? Number(v.toFixed(d)) : v);

// ============================================================
//  1. LISTEN FOR LIVE TELEMETRY
// ============================================================
onValue(ref(db, aeroCubePath + '/telemetry'), (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  // --- Overall Air Quality Banner ---
  const bannerInfo = getAirQualityBannerInfo(data.airQualityStatus);
  aqBanner.className = 'aq-status-banner state-' + (bannerInfo.state || '');
  aqBannerStatus.innerText = bannerInfo.label;
  aqBannerDesc.innerText = bannerInfo.desc;

  // --- CO2 ---
  if (data.co2 !== undefined) {
    valCo2.innerHTML = data.co2 + ' <span>ppm</span>';
    const s = getCo2Status(data.co2);
    setStatusPill(statusCo2, s.state, s.label);
    setCardVisual('card-co2', s.state);
    notifyMetricState('co2', s.state, data.co2 + ' ppm');
  }

  // --- PM2.5 ---
  if (data.pm && data.pm.pm2p5 !== undefined) {
    valPm25.innerHTML = fmt(data.pm.pm2p5) + ' <span>µg/m³</span>';
    const s = getPm25Status(data.pm.pm2p5);
    setStatusPill(statusPm25, s.state, s.label);
    setCardVisual('card-pm25', s.state);
  }

  // --- PM AQI (from firmware) ---
  if (data.pm && data.pm.pmAQI !== undefined) {
    valPmAqi.innerHTML = data.pm.pmAQI + ' <span>AQI</span>';
    const s = getPmAqiStatus(data.pm.pmAQI);
    setStatusPill(statusPmAqi, s.state, s.label);
    setCardVisual('card-pmaqi', s.state);
    notifyMetricState('pmaqi', s.state, data.pm.pmAQI);
  }

  // --- VOC Index ---
  if (data.VOCidx !== undefined) {
    valVoc.innerText = data.VOCidx;
    const s = getVocStatus(data.VOCidx);
    setStatusPill(statusVoc, s.state, s.label);
    setCardVisual('card-voc', s.state);
    notifyMetricState('voc', s.state, data.VOCidx);
  }

  // --- PM10 ---
  if (data.pm && data.pm.pm10p0 !== undefined) {
    valPm10.innerHTML = fmt(data.pm.pm10p0) + ' <span>µg/m³</span>';
    const s = getPm10Status(data.pm.pm10p0);
    setStatusPill(statusPm10, s.state, s.label);
    setCardVisual('card-pm10', s.state);
  }

  // --- Temperature ---
  if (data.temp !== undefined) {
    valTemp.innerHTML = fmt(data.temp) + ' <span>°C</span>';
  }

  // --- Humidity ---
  if (data.humidity !== undefined) {
    valHumidity.innerHTML = data.humidity + ' <span>%</span>';
  }

  // --- Additional PM (1.0 and 4.0) ---
  if (data.pm) {
    if (data.pm.pm1p0 !== undefined) valPm1.innerHTML = fmt(data.pm.pm1p0) + ' <span>µg/m³</span>';
    if (data.pm.pm4p0 !== undefined) valPm4.innerHTML = fmt(data.pm.pm4p0) + ' <span>µg/m³</span>';
  }

  // --- First-reading summary + Recommendations ---
  announceFirstReading();
  latestTelemetry = data;
  updateRecommendations(data);

  if (window.lucide) lucide.createIcons();
});

// ============================================================
//  2. LISTEN FOR DEVICE METADATA (lastSeen)
// ============================================================
let latestLastSeen = null;

onValue(ref(db, aeroCubePath + '/metadata'), (snapshot) => {
  const meta = snapshot.val();
  latestLastSeen = meta ? meta.lastSeen : null;
  updateDeviceConnectionStatus(latestLastSeen);
});

// Refresh the "time ago" text without creating new listeners
setInterval(() => updateDeviceConnectionStatus(latestLastSeen), 15000);

// ============================================================
//  3. LISTEN FOR AEROCUBE CONTROLS
// ============================================================
onValue(ref(db, aeroCubePath + '/controls'), (snapshot) => {
  const controls = snapshot.val();
  if (!controls) return;

  // Buzzer silenced
  if (controls.isBuzzerSilenced !== undefined && switchBuzzer) {
    // Switch ON = buzzer enabled (NOT silenced)
    switchBuzzer.checked = !controls.isBuzzerSilenced;
    textBuzzer.innerText = controls.isBuzzerSilenced ? 'SILENCED' : 'ON';
    switchBuzzer.disabled = false;
  }
});

// ============================================================
//  4. WRITE CONTROLS BACK TO FIREBASE
// ============================================================
function updateControls(partialState) {
  update(ref(db, aeroCubePath + '/controls'), partialState);
}

// Buzzer: checked = ON (enabled), unchecked = SILENCED
switchBuzzer?.addEventListener('change', (e) => {
  updateControls({ isBuzzerSilenced: !e.target.checked });
});

// ============================================================
//  5. RECOMMENDATIONS ENGINE (text comes from Firebase settings)
//  Firebase path: /Aerocubes/{id}/settings/recommendations
//  If a value is missing in Firebase, the default below is used.
// ============================================================
// Reads "recommendations" first, and also accepts the singular "recommendation"
const RECOMMENDATIONS_PATHS = [
  aeroCubePath + '/settings/recommendations',
  aeroCubePath + '/settings/recommendation'
];

const DEFAULT_RECOMMENDATIONS = {
  co2: {
    icon: 'wind',
    elevated: {
      title: 'CO₂ concentration is elevated.',
      text: 'Elevated carbon dioxide detected. Please briefly open nearby windows or doors to allow fresh air circulation'
    },
    poor: {
      title: 'CO₂ concentration is poor.',
      text: 'Unhealthy CO2 accumulation. Evacuate the room temporarily and quickly open windows to flush stagnant air.'
    }
  },
  pmaqi: {
    icon: 'circle-dot',
    elevated: {
      title: 'Particulate concentration is elevated.',
      text: 'Elevated fine dust or smoke. Cover cooking pots and refrain from burning incense indoors.'
    },
    poor: {
      title: 'Particulate concentration is poor.',
      text: 'Unhealthy particulate density. Minimize the source of particulate matter such as dust, smoke, etc. Close exterior windows if road dust or ash is present outside.'
    }
  },
  voc: {
    icon: 'flask-conical',
    elevated: {
      title: 'VOC levels are elevated.',
      text: 'Moderate chemical vapors present. Open windows or doors to ventilate the area.'
    },
    poor: {
      title: 'VOC levels are poor.',
      text: 'Heavy chemical saturation. Open windows or doors to quickly vent chemical plumes. Wear facemask if necessary.'
    }
  },
  good: {
    icon: 'check-circle',
    title: 'Air quality is within thresholds.',
    text: 'Air quality is optimal. Maintain current ventilation or manually open windows to enjoy fresh air.'
  }
};

let recommendationSettings = DEFAULT_RECOMMENDATIONS;
let latestTelemetry = null;

// A plain string in Firebase is treated as the message text.
function normalizeEntry(value) {
  if (typeof value === 'string') return { text: value };
  return value && typeof value === 'object' ? value : {};
}

function normalizeFlatRecommendations(remote) {
  if (!remote || typeof remote !== 'object') return remote;
  return {
    co2: {
      elevated: remote.co2_elevated,
      poor: remote.co2_poor
    },
    pmaqi: {
      elevated: remote.pm_elevated,
      poor: remote.pm_poor
    },
    voc: {
      elevated: remote.voc_elevated,
      poor: remote.voc_poor
    },
    good: remote.good
  };
}

// Combine Firebase values with the defaults (Firebase wins when present)
function mergeRecommendations(remote) {
  if (!remote || typeof remote !== 'object') return DEFAULT_RECOMMENDATIONS;
  remote = normalizeFlatRecommendations(remote);
  const merged = {};
  ['co2', 'pmaqi', 'voc'].forEach(key => {
    const d = DEFAULT_RECOMMENDATIONS[key];
    const r = remote[key] || {};
    merged[key] = {
      icon: r.icon || d.icon,
      elevated: { ...d.elevated, ...normalizeEntry(r.elevated) },
      poor: { ...d.poor, ...normalizeEntry(r.poor) }
    };
  });
  merged.good = { ...DEFAULT_RECOMMENDATIONS.good, ...normalizeEntry(remote.good) };
  return merged;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// Icon names from Firebase may only contain letters, numbers and dashes
function safeIcon(name, fallback) {
  return /^[a-z0-9-]+$/i.test(name || '') ? name : fallback;
}

// Listen for recommendation text changes in Firebase settings
const remoteRecommendations = [null, null];
onValue(ref(db, RECOMMENDATIONS_PATHS[0]), (snapshot) => {
  remoteRecommendations[0] = snapshot.val();
  recommendationSettings = mergeRecommendations(remoteRecommendations[0]);
  if (latestTelemetry && previousConnectionState !== false) {
    updateRecommendations(latestTelemetry);
  }
});

function getLevel(value, limits) {
  if (value === undefined || value === null) return null;
  if (value >= limits.poor) return 'poor';
  if (value >= limits.elevated) return 'elevated';
  return null;
}

function updateRecommendations(data) {
  const recs = [];
  const checks = [
    { key: 'co2',   value: data.co2,                          limits: THRESHOLDS.co2 },
    { key: 'pmaqi', value: data.pm ? data.pm.pmAQI : undefined, limits: THRESHOLDS.pmaqi },
    { key: 'voc',   value: data.VOCidx,                       limits: THRESHOLDS.voc }
  ];

  checks.forEach(({ key, value, limits }) => {
    const level = getLevel(value, limits);
    if (!level) return;
    const setting = recommendationSettings[key];
    const entry = setting[level];
    if (entry.enabled === false) return;
    recs.push({
      state: level,
      icon: safeIcon(entry.icon || setting.icon, 'info'),
      title: entry.title,
      text: entry.text
    });
  });

  // Everything normal
  if (recs.length === 0) {
    const good = recommendationSettings.good;
    if (good.enabled === false) {
      recContent.innerHTML = '';
      return;
    }
    recs.push({
      state: 'good',
      icon: safeIcon(good.icon, 'check-circle'),
      title: good.title,
      text: good.text
    });
  }

  recContent.innerHTML = recs.map(r => `
    <div class="rec-item rec-${r.state}">
      <div class="rec-icon"><i data-lucide="${escapeHtml(r.icon)}"></i></div>
      <div class="rec-text">
        <strong>${escapeHtml(r.title)}</strong>
        <p>${escapeHtml(r.text)}</p>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}