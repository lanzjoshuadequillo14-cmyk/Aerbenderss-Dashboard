// ============================================================
//  history.js — History page with time-range filtering
// ============================================================

import { db, auth, BASE_PATH } from './firebase.js';
import { ref, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
const aeroCubePath = '/Aerocubes/' + (localStorage.getItem('aerocube-id') || BASE_PATH.split('/').pop());

menuToggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

// ============================================================
//  STATE
// ============================================================
let currentTimeRange = 'today';
let allHistoryData = [];

document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
  const confirmed = window.confirm('Clear all history for this AeroCube? This cannot be undone.');
  if (!confirmed) return;

  try {
    await remove(ref(db, aeroCubePath + '/history'));
    allHistoryData = [];
    renderTable();
  } catch (error) {
    console.error('Error clearing history:', error);
    window.alert('Unable to clear history. Please try again.');
  }
});

// ============================================================
//  DECODE FIREBASE PUSH ID TO TIMESTAMP
// ============================================================
function getTimestampFromPushId(pushId) {
  const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  let time = 0;
  for (let i = 0; i < 8; i++) {
    time = (time * 64) + PUSH_CHARS.indexOf(pushId.charAt(i));
  }
  return time;
}

// ============================================================
//  FILTER DATA BY TIME RANGE
// ============================================================
function filterByTimeRange(data, range) {
  const now = Date.now();
  let cutoff;
  if (range === 'today') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    cutoff = startOfDay.getTime();
  } else if (range === '7d') {
    cutoff = now - (7 * 24 * 60 * 60 * 1000);
  } else if (range === '30d') {
    cutoff = now - (30 * 24 * 60 * 60 * 1000);
  } else {
    cutoff = 0;
  }
  return data.filter(item => item.timestamp >= cutoff);
}

// ============================================================
//  GET STATUS BADGE CLASS
// ============================================================
function getStatusBadgeClass(status) {
  const s = (status || 'NORMAL').toUpperCase();
  if (s === 'POOR' || s === 'CRITICAL' || s === 'BAD' || s === 'UNHEALTHY') return 'poor';
  if (s === 'ELEVATED' || s === 'WARNING' || s === 'MODERATE') return 'elevated';
  return 'good';
}

// ============================================================
//  LOAD HISTORY DATA FROM FIREBASE
// ============================================================
async function loadHistoryData() {
  const container = document.getElementById('history-table-container');

  try {
    const snapshot = await get(ref(db, aeroCubePath + '/history'));
    if (!snapshot.exists()) {
      allHistoryData = [];
      renderTable();
      return;
    }

    const historyObj = snapshot.val();
    const entries = [];

    for (const key in historyObj) {
      const log = historyObj[key];
      let timestamp = log.timestamp || log.time || log.created_at;
      if (!timestamp && key.startsWith('-')) {
        timestamp = getTimestampFromPushId(key);
      }
      entries.push({ ...log, timestamp: timestamp || 0 });
    }

    entries.sort((a, b) => b.timestamp - a.timestamp);
    allHistoryData = entries;
    renderTable();
  } catch (err) {
    console.error("Error loading history:", err);
    container.innerHTML = '<div class="history-empty"><i data-lucide="alert-circle"></i><p>Error loading data from Firebase.</p></div>';
    if (window.lucide) lucide.createIcons();
  }
}

// ============================================================
//  RENDER TABLE
// ============================================================
function renderTable() {
  const container = document.getElementById('history-table-container');
  const filtered = filterByTimeRange(allHistoryData, currentTimeRange);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <i data-lucide="inbox"></i>
        <p>Not enough historical data available for this time range.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let tableHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>TIME</th>
          <th>CO₂</th>
          <th>PM 2.5</th>
          <th>PM 10</th>
          <th>PM AQI</th>
          <th>VOC</th>
          <th>TEMP</th>
          <th>HUMIDITY</th>
          <th>AIR QUALITY</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach((item) => {
    const formattedTime = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';
    const co2 = item.co2 !== undefined ? item.co2 : '--';
    const pm25 = (item.pm && item.pm.pm2p5 !== undefined) ? item.pm.pm2p5 : '--';
    const pm10 = (item.pm && item.pm.pm10p0 !== undefined) ? item.pm.pm10p0 : '--';
    const pmAqi = (item.pm && item.pm.pmAQI !== undefined) ? item.pm.pmAQI : '--';
    const voc = item.VOCidx !== undefined ? item.VOCidx : '--';
    const temp = item.temp !== undefined ? item.temp + '°C' : '--';
    const humidity = item.humidity !== undefined ? item.humidity + '%' : '--';
    const status = item.airQualityStatus || 'NORMAL';
    const badgeClass = getStatusBadgeClass(status);

    tableHTML += `
      <tr>
        <td style="font-family: monospace; color: #cbd5e1;">${formattedTime}</td>
        <td>${co2}</td>
        <td>${pm25}</td>
        <td>${pm10}</td>
        <td>${pmAqi}</td>
        <td>${voc}</td>
        <td>${temp}</td>
        <td>${humidity}</td>
        <td><span class="status-badge ${badgeClass}">${status.toUpperCase()}</span></td>
      </tr>
    `;
  });

  tableHTML += '</tbody></table>';
  container.innerHTML = tableHTML;
}

// ============================================================
//  TIME RANGE BUTTON HANDLERS
// ============================================================
document.querySelectorAll('[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeRange = btn.dataset.range;
    renderTable();
  });
});

// --- LOAD DATA ON STARTUP ---
loadHistoryData();
