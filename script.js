import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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

const BASE_PATH = '/Aerocubes/aerocube_01'; 

// Target DOM Elements
const valTemp = document.getElementById('val-temp');
const subTemp = document.getElementById('sub-temp');
const valHumidity = document.getElementById('val-humidity');
const subHumidity = document.getElementById('sub-humidity');
const valCo2 = document.getElementById('val-co2');
const valVoc = document.getElementById('val-voc');
const valPm10 = document.getElementById('val-pm10');
const valPm25 = document.getElementById('val-pm25');
const valPm40 = document.getElementById('val-pm40');
const valPm100 = document.getElementById('val-pm100');
const valStatus = document.getElementById('val-status');
const aqiStatusBadge = document.getElementById('aqi-status-badge');

// Controls & Insight Elements
const btnAuto = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const switchRelay1 = document.getElementById('switch-relay1');
const switchRelay2 = document.getElementById('switch-relay2');
const switchSilent = document.getElementById('switch-silent');
const textRelay1 = document.getElementById('text-relay1');
const textRelay2 = document.getElementById('text-relay2');
const textSilent = document.getElementById('text-silent');
const insightText = document.getElementById('insight-text');
const recommendationText = document.getElementById('recommendation-text');
const btnLogout = document.getElementById('btn-logout');

// Flag to track if the current user is a viewer
let isViewerUser = false;

// --- AUTHENTICATION & ROLE VERIFICATION ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userRef = ref(db, 'users/' + user.uid);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        console.log("Logged in user role:", userData.role);

        if (userData.role === 'viewer') {
          isViewerUser = true;
          lockControlsForViewer();
        }
      }
    } catch (err) {
      console.error("Error checking user role:", err);
    }
  } else {
    window.location.href = 'Registration.html';
  }
});

function lockControlsForViewer() {
  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) {
    const badge = document.createElement('div');
    badge.style.display = 'inline-block';
    badge.style.background = 'rgba(234, 179, 8, 0.1)';
    badge.style.border = '1px solid rgba(234, 179, 8, 0.3)';
    badge.style.color = '#eab308';
    badge.style.padding = '2px 8px';
    badge.style.borderRadius = '4px';
    badge.style.fontSize = '0.75rem';
    badge.style.marginLeft = '10px';
    badge.style.verticalAlign = 'middle';
    badge.innerText = 'READ-ONLY VIEWER MODE';
    headerTitle.appendChild(badge);
  }

  const controlCenter = document.querySelector('.control-center');
  if (controlCenter) {
    controlCenter.style.opacity = '0.8';
  }
}

// --- LOGOUT FUNCTIONALITY ---
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

// Helper function for PM threshold updates
function updatePmBox(pmElement, value, moderateThreshold, criticalThreshold) {
    if (value === undefined || !pmElement) return; 
    
    pmElement.innerHTML = `${value} <span>µg/m³</span>`;
    
    const pmBox = pmElement.closest('.pm-box');
    const pmLabel = pmBox ? pmBox.querySelector('.pm-label') : null;
    
    if (value >= criticalThreshold) {
        pmElement.style.color = '#ef4444'; 
        if (pmLabel) pmLabel.style.color = '#ef4444'; 
        if (pmBox) {
            pmBox.classList.add('highlight');
            pmBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            pmBox.style.background = 'rgba(239, 68, 68, 0.05)';
        }
    } else if (value >= moderateThreshold) {
        pmElement.style.color = '#eab308'; 
        if (pmLabel) pmLabel.style.color = '#eab308';
        if (pmBox) {
            pmBox.classList.add('highlight');
            pmBox.style.borderColor = 'rgba(234, 179, 8, 0.4)';
            pmBox.style.background = 'rgba(234, 179, 8, 0.05)';
        }
    } else {
        pmElement.style.color = '#ffffff'; 
        if (pmLabel) pmLabel.style.color = '#64748b'; 
        if (pmBox) {
            pmBox.classList.remove('highlight');
            pmBox.style.borderColor = '#233147';
            pmBox.style.background = '#182232';
        }
    }
}

// 1. Listen for Live Telemetry from Hardware
onValue(ref(db, `${BASE_PATH}/telemetry`), (snapshot) => {
  const data = snapshot.val();
  if (!data) return; 

  // --- UPDATE METRICS UI ---
  if (data.temp !== undefined && valTemp) {
    valTemp.innerHTML = `${data.temp} <span>°C</span>`;
    if (subTemp) subTemp.innerText = `Live reading`;
  }
  if (data.humidity !== undefined && valHumidity) {
    valHumidity.innerHTML = `${data.humidity} <span>%</span>`;
    if (subHumidity) subHumidity.innerText = `Live reading`;
  }
  if (data.co2 !== undefined && valCo2) {
    valCo2.innerHTML = `${data.co2} <span>ppm</span>`;
  }
  if (data.VOCidx !== undefined && valVoc) {
    valVoc.innerText = data.VOCidx;
    valVoc.style.color = data.VOCidx >= 250 ? '#ef4444' : data.VOCidx >= 150 ? '#eab308' : '#ffffff';
  }
  
  if (data.pm) {
    updatePmBox(valPm10, data.pm.pm1p0, 35, 55);
    updatePmBox(valPm25, data.pm.pm2p5, 35, 55);
    updatePmBox(valPm40, data.pm.pm4p0, 35, 55);
    updatePmBox(valPm100, data.pm.pm10p0, 50, 100); 
  }

  // --- CLEAR, UNDERSTANDABLE INSIGHTS & RECOMMENDATIONS ---
  let insights = [];
  let recs = [];

  // A. Temperature
  if (data.temp !== undefined) {
      if (data.temp >= 30) {
          insights.push(`<strong>Temperature:</strong> The room is very hot (${data.temp}°C), which can make you feel tired or uncomfortable.`);
          recs.push(`<strong>Temperature:</strong> Turn on a fan, open a window to let a breeze in, or use an air conditioner if you have one.`);
      } else if (data.temp <= 18) {
          insights.push(`<strong>Temperature:</strong> The room is quite cold (${data.temp}°C).`);
          recs.push(`<strong>Temperature:</strong> Close open windows to keep the warmth inside, or turn on a heater.`);
      } else {
          insights.push(`<strong>Temperature:</strong> The room temperature is comfortable and safe.`);
          recs.push(`<strong>Temperature:</strong> No action needed.`);
      }
  }

  // B. Humidity
  if (data.humidity !== undefined) {
      if (data.humidity >= 70) {
          insights.push(`<strong>Humidity:</strong> The air is very damp (${data.humidity}%). This can feel muggy and might cause mold to grow on walls or fabrics.`);
          recs.push(`<strong>Humidity:</strong> Open windows to improve airflow, or turn on an exhaust fan or dehumidifier to dry the air.`);
      } else if (data.humidity <= 30) {
          insights.push(`<strong>Humidity:</strong> The air is very dry (${data.humidity}%), which can dry out your skin, eyes, and throat.`);
          recs.push(`<strong>Humidity:</strong> Consider using a humidifier or placing a bowl of water in the room to add moisture back into the air.`);
      } else {
          insights.push(`<strong>Humidity:</strong> The moisture level in the air is well-balanced.`);
          recs.push(`<strong>Humidity:</strong> No action needed.`);
      }
  }

  // C. Carbon Dioxide (CO2)
  if (data.co2 !== undefined) {
      if (data.co2 >= 1000) {
          insights.push(`<strong>Air Freshness (CO2):</strong> The room is getting stuffy (${data.co2} ppm). Breathing in stale air can cause headaches, sleepiness, and make it hard to focus.`);
          recs.push(`<strong>Air Freshness (CO2):</strong> Open doors and windows to let fresh air inside. If there are many people in the room, consider taking a short break outside.`);
      } else {
          insights.push(`<strong>Air Freshness (CO2):</strong> The air is fresh and well-ventilated.`);
          recs.push(`<strong>Air Freshness (CO2):</strong> Keep the room properly ventilated as it currently is.`);
      }
  }

  // D. Volatile Organic Compounds (VOC)
  if (data.VOCidx !== undefined) {
      if (data.VOCidx >= 150) {
          insights.push(`<strong>Odors & Chemicals (VOC):</strong> Strong smells or chemicals are detected in the air. This can irritate your eyes, nose, and throat.`);
          recs.push(`<strong>Odors & Chemicals (VOC):</strong> Find the source (like open paint cans, strong perfumes, or cleaning sprays) and close it. Open windows immediately to clear the air out.`);
      } else {
          insights.push(`<strong>Odors & Chemicals (VOC):</strong> Chemical and odor levels are low and safe.`);
          recs.push(`<strong>Odors & Chemicals (VOC):</strong> No action needed. Continue using household products safely.`);
      }
  }

  // E. Particulate Matter (Dust & Smoke)
  if (data.pm) {
      const isHighPm = (data.pm.pm1p0 >= 35 || data.pm.pm2p5 >= 35 || data.pm.pm4p0 >= 35 || data.pm.pm10p0 >= 50);
      if (isHighPm) {
          insights.push(`<strong>Particulate Matter (PM):</strong> There is a high amount of fine dust or smoke floating in the air. This is unhealthy to breathe in.`);
          recs.push(`<strong>Particulate Matter (PM):</strong> Stop activities that create dust, like sweeping. If the smoke is coming from outside (like traffic or burning leaves), close your windows. Consider wearing a mask if you are sensitive to dust.`);
      } else {
          insights.push(`<strong>Particulate Matter (PM):</strong> The air is clear of heavy dust and smoke particles.`);
          recs.push(`<strong>Particulate Matter (PM):</strong> No action needed.`);
      }
  }

  // Render Insights and Recommendations to DOM
  if (insightText && recommendationText) {
    const listStyle = "display: flex; flex-direction: column; gap: 0.75rem; color: #94a3b8; font-size: 0.88rem; line-height: 1.5;";
    insightText.innerHTML = `<div style="${listStyle}">${insights.map(i => `<div>${i}</div>`).join('')}</div>`;
    recommendationText.innerHTML = `<div style="${listStyle}">${recs.map(r => `<div>${r}</div>`).join('')}</div>`;
  }

  // Air Quality Status Check
  let status = (data.airQualityStatus || 'NORMAL').toUpperCase();
  if (!data.airQualityStatus) {
      if (data.co2 >= 1500 || data.VOCidx >= 250 || (data.pm && data.pm.pm2p5 >= 55)) status = 'CRITICAL';
      else if (data.co2 >= 1000 || data.VOCidx >= 150 || (data.pm && data.pm.pm2p5 >= 35)) status = 'WARNING';
  }
  
  if (valStatus) valStatus.innerText = `STATUS: ${status}`;

  if (aqiStatusBadge) {
      if (status === 'CRITICAL' || status === 'BAD') {
        aqiStatusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
        aqiStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        aqiStatusBadge.style.color = '#ef4444';
      } else if (status === 'WARNING' || status === 'MODERATE') {
        aqiStatusBadge.style.background = 'rgba(234, 179, 8, 0.1)';
        aqiStatusBadge.style.borderColor = 'rgba(234, 179, 8, 0.3)';
        aqiStatusBadge.style.color = '#eab308';
      } else {
        aqiStatusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        aqiStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        aqiStatusBadge.style.color = '#10b981';
      }
  }
});

// 2. Listen for Controls Status from Hardware
onValue(ref(db, `${BASE_PATH}/controls`), (snapshot) => {
  const controls = snapshot.val();
  if (!controls) return;

  if (isViewerUser) {
    if (btnAuto) btnAuto.disabled = true;
    if (btnManual) btnManual.disabled = true;
    if (switchRelay1) switchRelay1.disabled = true;
    if (switchRelay2) switchRelay2.disabled = true;
    if (switchSilent) switchSilent.disabled = true;
  } else {
    if(switchRelay1) switchRelay1.disabled = false;
    if(switchRelay2) switchRelay2.disabled = false;
    if(switchSilent) switchSilent.disabled = false;

    if (controls.isAutoMode !== undefined) {
      if (controls.isAutoMode) {
        if(btnAuto) btnAuto.classList.add('active');
        if(btnManual) btnManual.classList.remove('active');
        if(switchRelay1) switchRelay1.disabled = true;
        if(switchRelay2) switchRelay2.disabled = true;
      } else {
        if(btnManual) btnManual.classList.add('active');
        if(btnAuto) btnAuto.classList.remove('active');
        if(switchRelay1) switchRelay1.disabled = false;
        if(switchRelay2) switchRelay2.disabled = false;
      }
    }
  }

  if (controls.manualRelay1 !== undefined && switchRelay1) {
    switchRelay1.checked = controls.manualRelay1;
    if(textRelay1) textRelay1.innerText = controls.manualRelay1 ? 'ACTIVE' : 'INACTIVE';
  }
  
  if (controls.manualRelay2 !== undefined && switchRelay2) {
    switchRelay2.checked = controls.manualRelay2;
    if(textRelay2) textRelay2.innerText = controls.manualRelay2 ? 'ACTIVE' : 'INACTIVE';
  }

  if (controls.isBuzzerSilenced !== undefined && switchSilent) {
    switchSilent.checked = controls.isBuzzerSilenced;
    if(textSilent) textSilent.innerText = controls.isBuzzerSilenced ? 'ON' : 'OFF';
  }
});

// 3. Dispatch Controls back to Firebase (Blocked if Viewer)
function updateControls(newPartialState) {
  if (isViewerUser) {
    alert("Access Denied: Viewer accounts have read-only permissions and cannot modify controls.");
    return;
  }
  update(ref(db, `${BASE_PATH}/controls`), newPartialState);
}

if(btnAuto) btnAuto.addEventListener('click', () => updateControls({ isAutoMode: true }));
if(btnManual) btnManual.addEventListener('click', () => updateControls({ isAutoMode: false }));
if(switchRelay1) switchRelay1.addEventListener('change', (e) => updateControls({ manualRelay1: e.target.checked }));
if(switchRelay2) switchRelay2.addEventListener('change', (e) => updateControls({ manualRelay2: e.target.checked }));
if(switchSilent) switchSilent.addEventListener('change', (e) => updateControls({ isBuzzerSilenced: e.target.checked }));

// humberger menu toggle for mobile view
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebarOverlay');

function toggleMenu() {
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

if (menuToggle && sidebar && overlay) {
  menuToggle.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);
}