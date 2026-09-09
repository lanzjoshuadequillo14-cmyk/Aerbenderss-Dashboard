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

  // --- GENERALIZED (HARDWARE-AGNOSTIC) INSIGHTS & RECOMMENDATIONS ---
  let insights = [];
  let recs = [];

  // A. Carbon Dioxide (CO2)
  if (data.co2 !== undefined) {
      if (data.co2 >= 1000) {
          insights.push(`<strong>Carbon Dioxide (CO2):</strong> The room is poorly ventilated. Carbon dioxide is building up, which commonly causes drowsiness, headaches, and reduced focus.`);
          recs.push(`<strong>Carbon Dioxide (CO2):</strong> Increase natural airflow by opening windows and doors (if outdoor air is clean). If the room has a high occupancy, consider reducing the number of people inside or taking a 10-minute fresh air break.`);
      } else {
          insights.push(`<strong>Carbon Dioxide (CO2):</strong> Ventilation is excellent. The current airflow is sufficient for the number of people in the room.`);
          recs.push(`<strong>Carbon Dioxide (CO2):</strong> Keep the current ventilation setup. If windows are open, you may close them to conserve energy if weather conditions change.`);
      }
  }

  // B. Particulate Matter (PM)
  if (data.pm) {
      const isHighPm = (data.pm.pm1p0 >= 35 || data.pm.pm2p5 >= 35 || data.pm.pm4p0 >= 35 || data.pm.pm10p0 >= 50);
      if (isHighPm) {
          insights.push(`<strong>Particulate Matter (PM):</strong> Fine particle pollution is currently elevated. This is often caused by outdoor traffic, smoke, burning, or indoor activities like sweeping or dusty fabrics.`);
          recs.push(`<strong>Particulate Matter (PM):</strong> Check if the source is indoors (e.g., stop sweeping/vacuuming, extinguish candles/incense) or outdoors (e.g., close windows to block traffic smoke). If you are sensitive to dust, wearing a face mask (e.g., N95) may help.`);
      } else {
          insights.push(`<strong>Particulate Matter (PM):</strong> The air is clear of fine dust and smoke particles. Respiratory conditions are currently safe.`);
          recs.push(`<strong>Particulate Matter (PM):</strong> No changes needed. Continue standard cleaning routines.`);
      }
  }

  // C. Volatile Organic Compounds (VOC)
  if (data.VOCidx !== undefined) {
      if (data.VOCidx >= 150) {
          insights.push(`<strong>Volatile Organic Compounds (VOC):</strong> High levels of chemical gases or strong odors detected. This can cause eye, nose, or throat irritation.`);
          recs.push(`<strong>Volatile Organic Compounds (VOC):</strong> Locate and remove the source (e.g., seal containers of paint or cleaning products, stop using air fresheners or sprays). Increase airflow by opening windows to dilute the gases. If the odor is strong, step outside until levels return to normal.`);
      } else {
          insights.push(`<strong>Volatile Organic Compounds (VOC):</strong> Chemical gas levels are low. No significant off-gassing from paints, cleaning agents, or sprays detected.`);
          recs.push(`<strong>Volatile Organic Compounds (VOC):</strong> No action required. Continue using chemicals in well-ventilated areas.`);
      }
  }

  // D. Temperature (Generalized)
  if (data.temp !== undefined) {
      if (data.temp >= 30) {
          insights.push(`<strong>Temperature:</strong> Elevated heat level (${data.temp}°C). High ambient temperature can lead to fatigue or discomfort.`);
          recs.push(`<strong>Temperature:</strong> Adjust window shades or blinds to block direct sunlight and increase cross-ventilation.`);
      } else if (data.temp <= 18) {
          insights.push(`<strong>Temperature:</strong> Low ambient temperature (${data.temp}°C).`);
          recs.push(`<strong>Temperature:</strong> Close open drafts or windows to retain natural room heat.`);
      }
  }

  // E. Humidity (Generalized)
  if (data.humidity !== undefined) {
      if (data.humidity >= 70) {
          insights.push(`<strong>Humidity:</strong> High air moisture detected (${data.humidity}%). Excess moisture promotes mugginess and mold growth.`);
          recs.push(`<strong>Humidity:</strong> Improve natural airflow across moist areas and clear standing water.`);
      } else if (data.humidity <= 30) {
          insights.push(`<strong>Humidity:</strong> Dry atmospheric conditions (${data.humidity}%).`);
          recs.push(`<strong>Humidity:</strong> Keep doors closed to maintain indoor moisture balance.`);
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

// Mobile Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebarOverlay');

function toggleMenu() {
  if(sidebar) sidebar.classList.toggle('open');
  if(overlay) overlay.classList.toggle('active');
}

if (menuToggle && sidebar && overlay) {
  menuToggle.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);
}