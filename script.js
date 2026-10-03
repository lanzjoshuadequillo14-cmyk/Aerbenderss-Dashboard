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

function sendNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, tag: 'aerocube-alert' });
}

notificationButton?.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    window.alert('This browser does not support notifications.');
    return;
  }
  if (Notification.permission === 'default') await Notification.requestPermission();
  updateNotificationButton();
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
      online ? 'Live sensor data has resumed.' : 'No sensor data has been received for over 60 seconds.'
    );
  }
  previousConnectionState = online;
  if (!online) clearStaleSensorData();
}

function notifyMetricState(metricKey, state, title, detail) {
  if (notificationStates[metricKey] === state) return;
  const previousState = notificationStates[metricKey];
  notificationStates[metricKey] = state;
  if (previousState && previousState !== state) {
    sendNotification(title, detail);
  } else if (!previousState && state !== 'good') {
    sendNotification(title, detail);
  }
}

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
    notifyMetricState('co2', s.state, 'CO₂ level alert', 'CO₂ is ' + s.label.toLowerCase() + '. Current value: ' + data.co2 + ' ppm.');
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
    notifyMetricState('pmaqi', s.state, 'PM AQI alert', 'PM AQI is ' + s.label.toLowerCase() + '. Current value: ' + data.pm.pmAQI + '.');
  }

  // --- VOC Index ---
  if (data.VOCidx !== undefined) {
    valVoc.innerText = data.VOCidx;
    const s = getVocStatus(data.VOCidx);
    setStatusPill(statusVoc, s.state, s.label);
    setCardVisual('card-voc', s.state);
    notifyMetricState('voc', s.state, 'VOC level alert', 'VOC Index is ' + s.label.toLowerCase() + '. Current value: ' + data.VOCidx + '.');
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

  // --- Recommendations ---
  updateRecommendations(data);

  if (window.lucide) lucide.createIcons();
});

// ============================================================
//  2. LISTEN FOR DEVICE METADATA (lastSeen)
// ============================================================
onValue(ref(db, aeroCubePath + '/metadata'), (snapshot) => {
  const meta = snapshot.val();
  const lastSeen = meta ? meta.lastSeen : null;
  updateDeviceConnectionStatus(lastSeen);
});

// Periodically refresh the "time ago" text
setInterval(() => {
  onValue(ref(db, aeroCubePath + '/metadata/lastSeen'), (snapshot) => updateDeviceConnectionStatus(snapshot.val()));
}, 15000);

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
//  5. WRITE CONTROLS BACK TO FIREBASE
// ============================================================
function updateControls(partialState) {
  update(ref(db, aeroCubePath + '/controls'), partialState);
}

// Buzzer: checked = ON (enabled), unchecked = SILENCED
switchBuzzer?.addEventListener('change', (e) => {
  updateControls({ isBuzzerSilenced: !e.target.checked });
});

// ============================================================
//  6. RECOMMENDATIONS ENGINE (uses the same thresholds as the cards)
// ============================================================
function updateRecommendations(data) {
  const recs = [];

  // CO2 recommendation
  if (data.co2 !== undefined && data.co2 >= THRESHOLDS.co2.elevated) {
    const isPoor = data.co2 >= THRESHOLDS.co2.poor;
    recs.push({
      state: isPoor ? 'poor' : 'elevated',
      icon: 'wind',
      title: isPoor ? 'CO₂ concentration is poor.' : 'CO₂ concentration is elevated.',
      text: 'Consider improving indoor ventilation or activating the connected ventilation device.'
    });
  }

  // Particulate matter recommendation (based on PM AQI)
  if (data.pm && data.pm.pmAQI !== undefined && data.pm.pmAQI >= THRESHOLDS.pmaqi.elevated) {
    const isPoor = data.pm.pmAQI >= THRESHOLDS.pmaqi.poor;
    recs.push({
      state: isPoor ? 'poor' : 'elevated',
      icon: 'circle-dot',
      title: isPoor ? 'Particulate concentration is poor.' : 'Particulate concentration is elevated.',
      text: 'Consider reducing indoor particulate sources and improving ventilation or filtration.'
    });
  }

  // VOC recommendation
  if (data.VOCidx !== undefined && data.VOCidx >= THRESHOLDS.voc.elevated) {
    const isPoor = data.VOCidx >= THRESHOLDS.voc.poor;
    recs.push({
      state: isPoor ? 'poor' : 'elevated',
      icon: 'flask-conical',
      title: isPoor ? 'VOC levels are poor.' : 'VOC levels are elevated.',
      text: 'Consider checking for possible indoor sources of volatile compounds and improving ventilation.'
    });
  }

  // If everything is normal
  if (recs.length === 0) {
    recs.push({
      state: 'good',
      icon: 'check-circle',
      title: 'Air quality is within thresholds.',
      text: 'Indoor air quality is currently within the configured thresholds. Continue normal ventilation practices.'
    });
  }

  // Render recommendations
  recContent.innerHTML = recs.map(r => `
    <div class="rec-item rec-${r.state}">
      <div class="rec-icon"><i data-lucide="${r.icon}"></i></div>
      <div class="rec-text">
        <strong>${r.title}</strong>
        <p>${r.text}</p>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}