import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQP8psXqOg-yb1eQDXzONoEXV1CnIUAp0",
  authDomain: "aerocube-db.firebaseapp.com",
  databaseURL: "https://aerocube-db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aerocube-db",
  storageBucket: "aerocube-db.firebasestorage.app",
  messagingSenderId: "531621525535",
  appId: "1:531621525535:web:4fdfba99e7827790eafd2a",
  measurementId: "G-0NSQ3R1HE7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const chartInstances = {};

// Key mappings matching exact Firebase structure (including nested pm object)
const KEYS = {
  temp: ['temperature', 'temp', 'Temp', 'TEMPERATURE'],
  hum: ['humidity', 'hum', 'Hum', 'HUMIDITY'],
  co2: ['co2', 'CO2', 'carbonDioxide'],
  voc: ['VOCidx', 'voc', 'VOC', 'vocIndex', 'voc_idx'],
  pm1: ['pm1p0', 'pm1_0', 'pm1', 'pm_1_0', 'PM1_0', 'PM1'],
  pm25: ['pm2p5', 'pm2_5', 'pm25', 'pm_2_5', 'PM2_5', 'PM25'],
  pm4: ['pm4p0', 'pm4_0', 'pm4', 'pm_4_0', 'PM4_0', 'PM4'],
  pm10: ['pm10p0', 'pm10_0', 'pm10', 'pm_10_0', 'PM10_0', 'PM10']
};

// Extracts values from top-level or nested 'pm' object
function extractMetric(item, keyList) {
  if (!item || typeof item !== 'object') return 0;
  
  // 1. Check top-level properties
  for (const key of keyList) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      const parsed = parseFloat(item[key]);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // 2. Check nested 'pm' object (Firebase: pm -> pm1p0, pm2p5, etc.)
  if (item.pm && typeof item.pm === 'object') {
    for (const key of keyList) {
      if (item.pm[key] !== undefined && item.pm[key] !== null && item.pm[key] !== '') {
        const parsed = parseFloat(item.pm[key]);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  return 0;
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) { lucide.createIcons(); }

  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  menuToggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      if (snapshot.exists() && snapshot.val().role === 'admin') {
        const btnClear = document.getElementById('btn-clear-history');
        if (btnClear) btnClear.style.display = 'inline-block';
      }
      loadHistoryAndGraphData();
    } catch (err) {
      console.error("Auth initialization error:", err);
    }
  } else {
    window.location.href = 'Registration.html';
  }
});

function getTimestampFromPushId(pushId) {
  const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  let time = 0;
  for (let i = 0; i < 8; i++) { time = (time * 64) + PUSH_CHARS.indexOf(pushId.charAt(i)); }
  return time;
}

function loadHistoryAndGraphData() {
  const aerocubesRef = ref(db, 'Aerocubes');
  const container = document.getElementById('history-table-container');

  onValue(aerocubesRef, (snapshot) => {
    if (snapshot.exists()) {
      const aerocubesData = snapshot.val();
      const allHistoryEntries = [];

      for (const key in aerocubesData) {
        const node = aerocubesData[key];
        if (node && typeof node === 'object') {
          if (node.history) {
            for (const logKey in node.history) {
              const log = node.history[logKey];
              let calculatedTime = log.timestamp || log.time || log.created_at;
              if (!calculatedTime && logKey.startsWith('-')) {
                calculatedTime = getTimestampFromPushId(logKey);
              }
              allHistoryEntries.push({
                id: logKey,
                deviceId: key,
                derivedTimestamp: calculatedTime || Date.now(),
                ...log
              });
            }
          } else {
            allHistoryEntries.push({
              id: key,
              deviceId: key,
              derivedTimestamp: Date.now(),
              ...node
            });
          }
        }
      }

      if (allHistoryEntries.length === 0) {
        container.innerHTML = "<p class='loading-text'>No historical data records found.</p>";
        renderAllIndividualCharts([]);
        return;
      }

      allHistoryEntries.sort((a, b) => b.derivedTimestamp - a.derivedTimestamp);

      let tableHTML = `
        <table>
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>DEVICE / ROOM</th>
              <th>TEMP / HUM</th>
              <th>CO2 / VOC</th>
              <th>PM 1 / 2.5 / 4 / 10</th>
              <th>AIR QUALITY</th>
            </tr>
          </thead>
          <tbody>
      `;

      allHistoryEntries.forEach((item) => {
        let formattedTime = item.derivedTimestamp ? new Date(item.derivedTimestamp).toLocaleString() : 'N/A';
        const deviceLabel = item.room || item.location || item.deviceId || 'Unknown Device';
        
        const temp = extractMetric(item, KEYS.temp);
        const hum = extractMetric(item, KEYS.hum);
        const co2 = extractMetric(item, KEYS.co2);
        const voc = extractMetric(item, KEYS.voc);
        
        const pm1 = extractMetric(item, KEYS.pm1);
        const pm25 = extractMetric(item, KEYS.pm25);
        const pm4 = extractMetric(item, KEYS.pm4);
        const pm10 = extractMetric(item, KEYS.pm10);

        const status = String(item.airQualityStatus || item.status || 'NORMAL').toUpperCase();
        let statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
        
        if (['MODERATE', 'WARNING', 'POOR'].includes(status)) {
          statusStyle = 'background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3);';
        } else if (['BAD', 'UNHEALTHY', 'CRITICAL', 'DANGER'].includes(status)) {
          statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
        }

        tableHTML += `
          <tr>
            <td style="font-family: monospace; color: #cbd5e1;">${formattedTime}</td>
            <td style="font-weight: 500; color: #94a3b8;">${deviceLabel}</td>
            <td>${temp}°C / ${hum}%</td>
            <td>${co2} / ${voc}</td>
            <td>${pm1} / ${pm25} / ${pm4} / ${pm10}</td>
            <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; ${statusStyle}">${status}</span></td>
          </tr>
        `;
      });

      tableHTML += `</tbody></table>`;
      container.innerHTML = tableHTML;

      renderAllIndividualCharts([...allHistoryEntries].reverse());
    } else {
      container.innerHTML = "<p class='loading-text'>No 'Aerocubes' node found.</p>";
      renderAllIndividualCharts([]);
    }
  });
}

function renderAllIndividualCharts(chartData) {
  const labels = chartData.map(item => item.derivedTimestamp ? new Date(item.derivedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');

  function createOrUpdateChart(canvasId, badgeId, cardTitleText, dataArray, borderColorHex, unitSymbol = '') {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const badgeEl = document.getElementById(badgeId);
    if (badgeEl) {
      const latestVal = dataArray.length > 0 ? dataArray[dataArray.length - 1] : '--';
      badgeEl.textContent = `${latestVal}${unitSymbol}`;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, `${borderColorHex}40`); 
    gradient.addColorStop(1, `${borderColorHex}00`); 

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].data.labels = labels;
      chartInstances[canvasId].data.datasets[0].data = dataArray;
      chartInstances[canvasId].update('none');
    } else {
      chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: cardTitleText,
            data: dataArray,
            borderColor: borderColorHex,
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: dataArray.length > 30 ? 0 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: borderColorHex
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: { color: '#64748b', maxTicksLimit: 5, font: { size: 10 } },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#64748b', font: { size: 10 } },
              grid: { color: 'rgba(255, 255, 255, 0.05)' }
            }
          }
        }
      });
    }
  }

  createOrUpdateChart('chart-temp', 'badge-temp', 'Temperature', chartData.map(item => extractMetric(item, KEYS.temp)), '#38bdf8', '°C');
  createOrUpdateChart('chart-hum', 'badge-hum', 'Humidity', chartData.map(item => extractMetric(item, KEYS.hum)), '#a855f7', '%');
  createOrUpdateChart('chart-co2', 'badge-co2', 'Carbon Dioxide', chartData.map(item => extractMetric(item, KEYS.co2)), '#10b981', ' PPM');
  createOrUpdateChart('chart-voc', 'badge-voc', 'VOC Index', chartData.map(item => extractMetric(item, KEYS.voc)), '#f59e0b', '');
  
  createOrUpdateChart('chart-pm1', 'badge-pm1', 'PM 1.0', chartData.map(item => extractMetric(item, KEYS.pm1)), '#38bdf8', ' µg');
  createOrUpdateChart('chart-pm25', 'badge-pm25', 'PM 2.5', chartData.map(item => extractMetric(item, KEYS.pm25)), '#f43f5e', ' µg');
  createOrUpdateChart('chart-pm4', 'badge-pm4', 'PM 4.0', chartData.map(item => extractMetric(item, KEYS.pm4)), '#f59e0b', ' µg');
  createOrUpdateChart('chart-pm10', 'badge-pm10', 'PM 10', chartData.map(item => extractMetric(item, KEYS.pm10)), '#a855f7', ' µg');
}

document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
  if (confirm("Are you sure you want to permanently clear history logs across all Aerocubes?")) {
    try {
      const snapshot = await get(ref(db, 'Aerocubes'));
      if (snapshot.exists()) {
        const aerocubes = snapshot.val();
        for (const deviceId in aerocubes) {
          if (aerocubes[deviceId].history) {
             await remove(ref(db, `Aerocubes/${deviceId}/history`));
          }
        }
        alert("All history logs cleared successfully.");
      }
    } catch (err) {
      console.error("Clear history error:", err);
      alert("Failed to clear history logs.");
    }
  }
});

document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = 'Registration.html';
  } catch (err) {
    console.error("Logout error:", err);
  }
});