// ============================================================
//  graph.js — Analytics page with chart selector + time filters
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
//  CHART CONFIGURATION
// ============================================================
const METRIC_CONFIG = {
  co2:      { label: 'CO₂ (ppm)',     color: '#10b981', path: 'co2', unit: ' ppm' },
  pmaqi:    { label: 'PM AQI',         color: '#38bdf8', path: 'pm.pmAQI', unit: '' },
  voc:      { label: 'VOC Index',      color: '#f59e0b', path: 'VOCidx', unit: '' },
  temp:     { label: 'Temperature (°C)', color: '#38bdf8', path: 'temp' },
  humidity: { label: 'Humidity (%)',   color: '#a855f7', path: 'humidity' }
};

let currentTimeRange = '24h';
const chartInstances = {};
let allHistoryData = [];

document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
  const confirmed = window.confirm('Clear all history for this AeroCube? This cannot be undone.');
  if (!confirmed) return;

  try {
    await remove(ref(db, aeroCubePath + '/history'));
    allHistoryData = [];
    renderAllCharts();
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
//  EXTRACT NESTED VALUE FROM OBJECT USING DOT PATH
// ============================================================
function getValueByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// ============================================================
//  FILTER DATA BY TIME RANGE
// ============================================================
function filterByTimeRange(data, range) {
  const now = Date.now();
  let cutoff;
  if (range === '24h') {
    cutoff = now - (24 * 60 * 60 * 1000);
  } else if (range === '7d') {
    cutoff = now - (7 * 24 * 60 * 60 * 1000);
  } else if (range === 'month') {
    cutoff = now - (30 * 24 * 60 * 60 * 1000);
  } else {
    cutoff = 0;
  }
  return data.filter(item => item.timestamp >= cutoff);
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function renderMetricSummary(metricKey, filteredData) {
  const config = METRIC_CONFIG[metricKey];
  const values = filteredData
    .map(item => ({ value: parseFloat(getValueByPath(item, config.path)), timestamp: item.timestamp }))
    .filter(item => !Number.isNaN(item.value));

  const averageElement = document.getElementById('average-' + metricKey);
  const highestElement = document.getElementById('highest-' + metricKey);
  const lowestElement = document.getElementById('lowest-' + metricKey);
  if (!averageElement || !highestElement || !lowestElement) return;

  if (values.length === 0) {
    averageElement.innerText = '--';
    highestElement.innerText = '--';
    lowestElement.innerText = '--';
    return;
  }

  const average = values.reduce((sum, item) => sum + item.value, 0) / values.length;
  const highest = values.reduce((result, item) => item.value > result.value ? item : result);
  const lowest = values.reduce((result, item) => item.value < result.value ? item : result);
  const unit = config.unit;

  averageElement.innerText = average.toFixed(1) + unit;
  highestElement.innerText = highest.value + unit + ' · ' + formatDateTime(highest.timestamp);
  lowestElement.innerText = lowest.value + unit + ' · ' + formatDateTime(lowest.timestamp);
}

// ============================================================
//  LOAD HISTORY DATA FROM FIREBASE
// ============================================================
async function loadHistoryData() {
  try {
    const snapshot = await get(ref(db, aeroCubePath + '/history'));
    if (!snapshot.exists()) {
      allHistoryData = [];
      renderAllCharts();
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

    entries.sort((a, b) => a.timestamp - b.timestamp);
    allHistoryData = entries;
    renderAllCharts();
  } catch (err) {
    console.error("Error loading history:", err);
    allHistoryData = [];
    renderAllCharts();
  }
}

// ============================================================
//  RENDER CHARTS
// ============================================================
function renderChart(metricKey) {
  const config = METRIC_CONFIG[metricKey];
  const filtered = filterByTimeRange(allHistoryData, currentTimeRange);
  const canvas = document.getElementById('chart-' + metricKey);
  const emptyState = document.getElementById('empty-' + metricKey);
  if (!canvas || !emptyState) return;

  if (filtered.length === 0) {
    canvas.style.display = 'none';
    emptyState.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    return;
  }

  canvas.style.display = 'block';
  emptyState.style.display = 'none';

  const labels = filtered.map(item => {
    const d = new Date(item.timestamp);
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  });

  const values = filtered.map(item => {
    const v = getValueByPath(item, config.path);
    return v !== undefined ? parseFloat(v) : null;
  });

  const hasValues = values.some(value => value !== null && !Number.isNaN(value));
  if (!hasValues) {
    canvas.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, config.color + '40');
  gradient.addColorStop(1, config.color + '00');

  if (chartInstances[metricKey]) {
    const chart = chartInstances[metricKey];
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = gradient;
    chart.update('none');
  } else {
    chartInstances[metricKey] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: config.label,
          data: values,
          borderColor: config.color,
          backgroundColor: gradient,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: filtered.length > 50 ? 0 : 3,
          pointHoverRadius: 6,
          pointBackgroundColor: config.color
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#131a27',
            borderColor: '#1e293b',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#64748b',
              autoSkip: true,
              maxTicksLimit: 5,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 10 }
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }
}

function renderAllCharts() {
  const filtered = filterByTimeRange(allHistoryData, currentTimeRange);
  ['co2', 'voc', 'pmaqi'].forEach(metricKey => renderMetricSummary(metricKey, filtered));
  Object.keys(METRIC_CONFIG).forEach(renderChart);
  if (window.lucide) lucide.createIcons();
}

// ============================================================
//  EVENT LISTENERS — TIME RANGE
// ============================================================
document.querySelectorAll('[data-range]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTimeRange = btn.dataset.range;
    renderAllCharts();
  });
});

// --- LOAD DATA ON STARTUP ---
loadHistoryData();
