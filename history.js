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

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  initHamburgerMenu();
});

// Helper function to safely extract metric values (checks nested 'pm' object and top-level)
function extractPMMetric(item, possibleKeys) {
  if (!item || typeof item !== 'object') return '--';

  // 1. Check inside nested 'pm' node (e.g. item.pm.pm1p0)
  if (item.pm && typeof item.pm === 'object') {
    for (const key of possibleKeys) {
      if (item.pm[key] !== undefined && item.pm[key] !== null && item.pm[key] !== '') {
        return item.pm[key];
      }
    }
  }

  // 2. Fallback to top-level properties (e.g. item.pm1p0)
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }

  return '--';
}

// Authentication & Route Protection
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Show admin link and clear button if user is admin
        if (userData.role === 'admin') {
          const navAdmin = document.getElementById('nav-admin');
          const btnClear = document.getElementById('btn-clear-history');
          if (navAdmin) navAdmin.style.display = 'flex';
          if (btnClear) btnClear.style.display = 'inline-block';
        }
      }
      
      // Load stored database entries from Aerocubes path
      loadHistoryData();
    } catch (err) {
      console.error("Auth error:", err);
    }
  } else {
    window.location.href = 'Registration.html';
  }
});

// Helper function to decode Firebase push ID into approximate epoch timestamp
function getTimestampFromPushId(pushId) {
  const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  let time = 0;
  for (let i = 0; i < 8; i++) {
    time = (time * 64) + PUSH_CHARS.indexOf(pushId.charAt(i));
  }
  return time;
}

// Fetch and Render History Logs from 'Aerocubes' Node
function loadHistoryData() {
  const aerocubesRef = ref(db, 'Aerocubes');
  const container = document.getElementById('history-table-container');

  onValue(aerocubesRef, (snapshot) => {
    if (snapshot.exists()) {
      const aerocubesData = snapshot.val();
      const allHistoryEntries = [];

      // Loop through each Aerocube device (e.g., aerocube_01)
      for (const deviceId in aerocubesData) {
        const device = aerocubesData[deviceId];

        // Check if the device has a history node
        if (device && device.history) {
          const historyLogs = device.history;

          for (const logKey in historyLogs) {
            const log = historyLogs[logKey];
            
            // Extract or derive timestamp safely
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
        } else if (device) {
          // Fallback: If no history sub-node exists yet, include current root readings
          allHistoryEntries.push({
            id: deviceId,
            deviceId: deviceId,
            derivedTimestamp: device.lastUpdated || device.timestamp || Date.now(),
            ...device
          });
        }
      }

      if (allHistoryEntries.length === 0) {
        container.innerHTML = "<p style='color: #64748b; font-size: 14px;'>No historical data records found inside device history logs.</p>";
        return;
      }

      // Sort entries by timestamp (most recent first)
      allHistoryEntries.sort((a, b) => b.derivedTimestamp - a.derivedTimestamp);

      let tableHTML = `
        <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 850px;">
          <thead>
            <tr style="border-bottom: 2px solid #1e293b; color: #94a3b8; font-size: 13px;">
              <th style="padding: 12px 16px;">TIMESTAMP</th>
              <th style="padding: 12px 16px;">DEVICE / ROOM</th>
              <th style="padding: 12px 16px;">TEMPERATURE</th>
              <th style="padding: 12px 16px;">HUMIDITY</th>
              <th style="padding: 12px 16px;">CO2 (PPM)</th>
              <th style="padding: 12px 16px;">VOC INDEX</th>
              <th style="padding: 12px 16px;">PM 1 / 2.5 / 4 / 10</th>
              <th style="padding: 12px 16px;">AIR QUALITY</th>
            </tr>
          </thead>
          <tbody>
      `;

      allHistoryEntries.forEach((item) => {
        // Format Timestamp cleanly
        let formattedTime = 'N/A';
        if (item.derivedTimestamp) {
          const dateObj = new Date(item.derivedTimestamp);
          formattedTime = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString();
        }

        // Room/Device identifier mapping
        const deviceLabel = item.room || item.location || item.deviceId;

        // Extract accurate parameters matching database structure
        const temp = item.temperature !== undefined ? `${item.temperature}°C` : (item.temp !== undefined ? `${item.temp}°C` : '--');
        const humidity = item.humidity !== undefined ? `${item.humidity}%` : (item.hum !== undefined ? `${item.hum}%` : '--');
        const co2Val = item.co2 !== undefined ? item.co2 : '--';
        const vocVal = item.VOCidx !== undefined ? item.VOCidx : (item.voc !== undefined ? item.voc : '--');
        
        // Extract Particulate Matter (PM) readings from nested 'pm' object or flat keys
        const pm1 = extractPMMetric(item, ['pm1p0', 'pm1_0', 'pm1', 'PM1_0']);
        const pm25 = extractPMMetric(item, ['pm2p5', 'pm2_5', 'pm25', 'PM2_5']);
        const pm4 = extractPMMetric(item, ['pm4p0', 'pm4_0', 'pm4', 'PM4_0']);
        const pm10 = extractPMMetric(item, ['pm10p0', 'pm10_0', 'pm10', 'PM10_0']);
        const pmFormatted = `${pm1} / ${pm25} / ${pm4} / ${pm10}`;

        // Match exact property name for air quality status
        const status = item.airQualityStatus || item.status || 'NORMAL';

        // Dynamic badge styling based on air quality status
        let statusStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
        const upperStatus = String(status).toUpperCase();
        
        if (upperStatus === 'MODERATE' || upperStatus === 'WARNING' || upperStatus === 'POOR') {
          statusStyle = 'background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3);';
        } else if (upperStatus === 'BAD' || upperStatus === 'UNHEALTHY' || upperStatus === 'CRITICAL' || upperStatus === 'DANGER') {
          statusStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
        }

        tableHTML += `
          <tr style="border-bottom: 1px solid #1e293b; transition: background 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 16px; font-size: 13px; color: #e2e8f0; font-family: monospace;">${formattedTime}</td>
            <td style="padding: 16px; font-size: 14px; color: #94a3b8; font-weight: 500;">${deviceLabel}</td>
            <td style="padding: 16px; font-size: 14px; color: #e2e8f0;">${temp}</td>
            <td style="padding: 16px; font-size: 14px; color: #e2e8f0;">${humidity}</td>
            <td style="padding: 16px; font-size: 14px; color: #e2e8f0;">${co2Val}</td>
            <td style="padding: 16px; font-size: 14px; color: #e2e8f0;">${vocVal}</td>
            <td style="padding: 16px; font-size: 14px; color: #e2e8f0;">${pmFormatted}</td>
            <td style="padding: 16px;">
              <span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; ${statusStyle}">${upperStatus}</span>
            </td>
          </tr>
        `;
      });

      tableHTML += `</tbody></table>`;
      container.innerHTML = tableHTML;
    } else {
      container.innerHTML = "<p style='color: #64748b; font-size: 14px;'>No 'Aerocubes' node found in database.</p>";
    }
  });
}

// Clear History Button Handler for all Aerocubes (Admins only)
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

// Navigation Toggle & Logout Setup
function initHamburgerMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (menuToggle && sidebar && overlay) {
    const toggleMenu = () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    };
    menuToggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });
    overlay.addEventListener('click', toggleMenu);
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        window.location.href = 'Registration.html';
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }
}