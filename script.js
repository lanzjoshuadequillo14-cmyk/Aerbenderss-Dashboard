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
    // If no user is logged in, redirect them back to the login/registration page
    window.location.href = 'Registration.html';
  }
});

function lockControlsForViewer() {
  // Add a visual "VIEWER MODE" indicator badge to the header
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

  // Visually dim the control section slightly to signify it's locked
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
    if (value === undefined) return; 
    
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
  if (data.temp !== undefined) {
    valTemp.innerHTML = `${data.temp} <span>°C</span>`;
    subTemp.innerText = `Live reading`;
  }
  if (data.humidity !== undefined) {
    valHumidity.innerHTML = `${data.humidity} <span>%</span>`;
    subHumidity.innerText = `Live reading`;
  }
  if (data.co2 !== undefined) {
    valCo2.innerHTML = `${data.co2} <span>ppm</span>`;
  }
  if (data.VOCidx !== undefined) {
    valVoc.innerText = data.VOCidx;
    valVoc.style.color = data.VOCidx >= 250 ? '#ef4444' : data.VOCidx >= 150 ? '#eab308' : '#ffffff';
  }
  
  if (data.pm) {
    updatePmBox(valPm10, data.pm.pm1p0, 35, 55);
    updatePmBox(valPm25, data.pm.pm2p5, 35, 55);
    updatePmBox(valPm40, data.pm.pm4p0, 35, 55);
    updatePmBox(valPm100, data.pm.pm10p0, 50, 100); 
  }

  // --- PRECISE INDIVIDUAL INSIGHTS & RECOMMENDATIONS ---
  let insights = [];
  let recs = [];

  if (data.temp !== undefined) {
      if (data.temp >= 32) {
          insights.push(`<strong>Temperature:</strong> Critically high (${data.temp}°C). Thermal stress conditions.`);
          recs.push(`<strong>Temperature:</strong> Engage active cooling systems or AC units immediately.`);
      } else if (data.temp >= 28) {
          insights.push(`<strong>Temperature:</strong> Moderate heat buildup (${data.temp}°C).`);
          recs.push(`<strong>Temperature:</strong> Increase ambient circulation fans to reduce heat density.`);
      } else if (data.temp <= 18) {
          insights.push(`<strong>Temperature:</strong> Below optimal range (${data.temp}°C).`);
          recs.push(`<strong>Temperature:</strong> Reduce cold air intake or activate heating elements.`);
      } else {
          insights.push(`<strong>Temperature:</strong> Optimal thermal range (${data.temp}°C).`);
          recs.push(`<strong>Temperature:</strong> Maintain standard HVAC thermal settings.`);
      }
  }

  if (data.humidity !== undefined) {
      if (data.humidity >= 70) {
          insights.push(`<strong>Humidity:</strong> High air moisture content (${data.humidity}%). Mold risk.`);
          recs.push(`<strong>Humidity:</strong> Activate dehumidifier or cycle dry air exhaust fans.`);
      } else if (data.humidity <= 30) {
          insights.push(`<strong>Humidity:</strong> Dry atmospheric conditions (${data.humidity}%).`);
          recs.push(`<strong>Humidity:</strong> Operate humidifiers to prevent respiratory dryness.`);
      } else {
          insights.push(`<strong>Humidity:</strong> Balanced air moisture level (${data.humidity}%).`);
          recs.push(`<strong>Humidity:</strong> No humidity conditioning needed.`);
      }
  }

  if (data.co2 !== undefined) {
      if (data.co2 >= 1500) {
          insights.push(`<strong>CO2:</strong> Severe gas buildup (${data.co2} ppm). Stale oxygen environment.`);
          recs.push(`<strong>CO2:</strong> Open fresh air vents or main windows immediately.`);
      } else if (data.co2 >= 1000) {
          insights.push(`<strong>CO2:</strong> Elevated concentration (${data.co2} ppm). Low air exchange rate.`);
          recs.push(`<strong>CO2:</strong> Increase general fresh air exchange and intake rates.`);
      } else {
          insights.push(`<strong>CO2:</strong> Optimal fresh air levels (${data.co2} ppm).`);
          recs.push(`<strong>CO2:</strong> Standby mode—air ventilation balance is sufficient.`);
      }
  }

  if (data.VOCidx !== undefined) {
      if (data.VOCidx >= 250) {
          insights.push(`<strong>VOC:</strong> Critical chemical vapor index (${data.VOCidx} idx). High off-gassing.`);
          recs.push(`<strong>VOC:</strong> Isolate chemical sources, solvents, or paints immediately.`);
      } else if (data.VOCidx >= 150) {
          insights.push(`<strong>VOC:</strong> Moderate chemical gas presence (${data.VOCidx} idx).`);
          recs.push(`<strong>VOC:</strong> Check and seal volatile containers or open solvents.`);
      } else {
          insights.push(`<strong>VOC:</strong> Minimal chemical vapors (${data.VOCidx} idx). Safe gas levels.`);
          recs.push(`<strong>VOC:</strong> No chemical mitigation required.`);
      }
  }

  if (data.pm) {
      let pmIssues = [];
      let pmActions = [];

      if (data.pm.pm1p0 >= 35) {
          pmIssues.push(`PM1.0 high combustion load`);
          pmActions.push(`run HEPA filtration at maximum`);
      }
      if (data.pm.pm2p5 >= 35) {
          pmIssues.push(`PM2.5 elevated fine dust/smoke`);
          pmActions.push(`activate smoke filtration`);
      }
      if (data.pm.pm4p0 >= 35) {
          pmIssues.push(`PM4.0 environmental dust load detected`);
          pmActions.push(`clean primary intake pre-filters`);
      }
      if (data.pm.pm10p0 >= 50) {
          pmIssues.push(`PM10 coarse dust/pollen buildup`);
          pmActions.push(`seal exterior intake dampers`);
      }

      if (pmIssues.length > 0) {
          insights.push(`<strong>PM:</strong> ${pmIssues.join('; ')}.`);
          recs.push(`<strong>PM:</strong> ${pmActions.join('; ')}.`);
      } else {
          insights.push(`<strong>PM:</strong> Clean particle readings across all metrics (PM 1.0 - PM 10).`);
          recs.push(`<strong>PM:</strong> Maintain normal background air filtration levels.`);
      }
  }

  if (insightText && recommendationText) {
    const listStyle = "display: flex; flex-direction: column; gap: 0.5rem; color: #94a3b8; font-size: 0.88rem; line-height: 1.4;";
    insightText.innerHTML = `<div style="${listStyle}">${insights.map(i => `<div>${i}</div>`).join('')}</div>`;
    recommendationText.innerHTML = `<div style="${listStyle}">${recs.map(r => `<div>${r}</div>`).join('')}</div>`;
  }

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

  // STRICT ENFORCEMENT: If viewer, lock out controls completely regardless of database state
  if (isViewerUser) {
    if (btnAuto) btnAuto.disabled = true;
    if (btnManual) btnManual.disabled = true;
    if (switchRelay1) switchRelay1.disabled = true;
    if (switchRelay2) switchRelay2.disabled = true;
    if (switchSilent) switchSilent.disabled = true;
  } else {
    // Admin user gets standard hardware interaction rules
    if(switchRelay1) switchRelay1.disabled = false;
    if(switchRelay2) switchRelay2.disabled = false;
    if(switchSilent) switchSilent.disabled = false;

    if (controls.isAutoMode !== undefined) {
      if (controls.isAutoMode) {
        btnAuto.classList.add('active');
        btnManual.classList.remove('active');
        if(switchRelay1) switchRelay1.disabled = true;
        if(switchRelay2) switchRelay2.disabled = true;
      } else {
        btnManual.classList.add('active');
        btnAuto.classList.remove('active');
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
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

if (menuToggle && sidebar && overlay) {
  menuToggle.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);
}