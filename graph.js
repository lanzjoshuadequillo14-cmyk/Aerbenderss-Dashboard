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

let aerocubeChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  // Hamburger drawer open/close hooks
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

// Authentication Guard & Admin UI check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.role === 'admin') {
          const navAdmin = document.getElementById('nav-admin');
          const btnClear = document.getElementById('btn-clear-history');
          if (navAdmin) navAdmin.style.display = 'block';
          if (btnClear) btnClear.style.display = 'inline-block';
        }
      }
      loadHistoryAndGraphData();
    } catch (err) {
      console.error("Auth initialization error:", err);
    }
  } else {
    window.location.href = 'Registration.html';
  }
});

// Helper function to extract explicit timestamps or derive from Firebase push IDs
function getTimestampFromPushId(pushId) {
  const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  let time = 0;
  for (let i = 0; i < 8; i++) {
    time = (time * 64) + PUSH_CHARS.indexOf(pushId.charAt(i));
  }
  return time;
}

// Main data fetch handler tracking real-time database updates
function loadHistoryAndGraphData() {
  const aerocubesRef = ref(db, 'Aerocubes');
  const container = document.getElementById('history-table-container');

  onValue(aerocubesRef, (snapshot) => {
    if (snapshot.exists()) {
      const aerocubesData = snapshot.val();
      const allHistoryEntries = [];

      for (const deviceId in aerocubesData) {
        const device = aerocubesData[deviceId];
        if (device && device.history) {
          const historyLogs = device.history;

          for (const logKey in historyLogs) {
            const log = historyLogs[logKey];
            
            let calculatedTime = log.timestamp || log.time || log.created_at;
            if (!calculatedTime && logKey.startsWith('-')) {
              calculatedTime = getTimestampFromPushId(logKey);
            }

            allHistoryEntries.push({
              id: logKey,
              deviceId: deviceId,
              derivedTimestamp: calculatedTime || 0,
              ...log
            });
          }
        }
      }

      if (allHistoryEntries.length === 0) {
        container.innerHTML = "<p style='color: #64748b; font-size: 14px;'>No historical data records found inside device history logs.</p>";
        if (aerocubeChartInstance) aerocubeChartInstance.destroy();
        return;
      }

      // Sort records newest-first for the data table
      allHistoryEntries.sort((a, b) => b.derivedTimestamp - a.derivedTimestamp);

      let tableHTML = `
        <table>
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>DEVICE / ROOM</th>
              <th>TEMPERATURE</th>
              <th>HUMIDITY</th>
              <th>CO2 (PPM)</th>
              <th>VOC INDEX</th>
              <th>AIR QUALITY</th>
            </tr>
          </thead>
          <tbody>
      `;

      allHistoryEntries.forEach((item) => {
        let formattedTime = 'N/A';
        if (item.derivedTimestamp) {
          const dateObj = new Date(item.derivedTimestamp);
          formattedTime = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString();
        }

        const deviceLabel = item.room || item.location || item.deviceId;
        const temp = item.temperature !== undefined ? `${item.temperature}°C` : (item.temp !== undefined ? `${item.temp}°C` : '--');
        const humidity = item.humidity !== undefined ? `${item.humidity}%` : (item.hum !== undefined ? `${item.hum}%` : '--');
        const co2Val = item.co2 !== undefined ? item.co2 : '--';
        const vocVal = item.VOCidx !== undefined ? item.VOCidx : (item.voc !== undefined ? item.voc : '--');
        const status = item.airQualityStatus || item.status || 'NORMAL';

        let statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
        const upperStatus = String(status).toUpperCase();
        
        if (upperStatus === 'MODERATE' || upperStatus === 'WARNING' || upperStatus === 'POOR') {
          statusStyle = 'background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3);';
        } else if (upperStatus === 'BAD' || upperStatus === 'UNHEALTHY' || upperStatus === 'CRITICAL' || upperStatus === 'DANGER') {
          statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
        }

        tableHTML += `
          <tr>
            <td style="font-family: monospace; color: #cbd5e1;">${formattedTime}</td>
            <td style="font-weight: 500; color: #94a3b8;">${deviceLabel}</td>
            <td>${temp}</td>
            <td>${humidity}</td>
            <td>${co2Val}</td>
            <td>${vocVal}</td>
            <td><span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; ${statusStyle}">${upperStatus}</span></td>
          </tr>
        `;
      });

      tableHTML += `</tbody></table>`;
      container.innerHTML = tableHTML;

      // Reverse array back to chronological order for proper chart timeline visualization
      renderAerocubeChart([...allHistoryEntries].reverse());
    } else {
      container.innerHTML = "<p style='color: #64748b; font-size: 14px;'>No 'Aerocubes' node found in database.</p>";
      if (aerocubeChartInstance) aerocubeChartInstance.destroy();
    }
  });
}

// Chart.js initialization logic with multi-axis support for CO2, Temperature, Humidity, and VOC
function renderAerocubeChart(chartData) {
  const ctx = document.getElementById('aerocubeChart')?.getContext('2d');
  if (!ctx) return;

  const labels = chartData.map(item => {
    return item.derivedTimestamp ? new Date(item.derivedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
  });

  const co2Dataset = chartData.map(item => item.co2 || 0);
  const tempDataset = chartData.map(item => item.temperature || item.temp || 0);
  const humidityDataset = chartData.map(item => item.humidity || item.hum || 0);
  const vocDataset = chartData.map(item => item.VOCidx || item.voc || 0);

  if (aerocubeChartInstance) {
    aerocubeChartInstance.destroy();
  }

  aerocubeChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'CO2 (PPM)',
          data: co2Dataset,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Temperature (°C)',
          data: tempDataset,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.05)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'Humidity (%)',
          data: humidityDataset,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y1'
        },
        {
          label: 'VOC Index',
          data: vocDataset,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8 },
          grid: { color: '#1e293b' }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'CO2 (PPM) & VOC Index', color: '#10b981' },
          ticks: { color: '#64748b' },
          grid: { color: '#1e293b' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Temperature (°C) & Humidity (%)', color: '#38bdf8' },
          ticks: { color: '#64748b' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

// Admin action: clear logs across devices
document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
  if (confirm("Are you sure you want to permanently clear history logs across all Aerocubes?")) {
    try {
      const snapshot = await get(ref(db, 'Aerocubes'));
      if (snapshot.exists()) {
        const aerocubes = snapshot.val();
        for (const deviceId in aerocubes) {
          await remove(ref(db, `Aerocubes/${deviceId}/history`));
        }
        alert("All history logs cleared successfully.");
      }
    } catch (err) {
      console.error("Clear history error:", err);
      alert("Failed to clear history.");
    }
  }
});

// Logout event handler
document.getElementById('btn-logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = 'Registration.html';
  } catch (err) {
    console.error("Logout error:", err);
  }
});