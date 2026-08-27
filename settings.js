import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://aerocube-db-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const BASE_PATH = '/Aerocubes/aerocube_01'; 

// --- TARGET ALL DOM ELEMENTS ---

// Thresholds (Right Column)
const valCo2 = document.getElementById('val-co2');
const sliderCo2 = document.getElementById('slider-co2');
const valVoc = document.getElementById('val-voc');
const sliderVoc = document.getElementById('slider-voc');
const valPm = document.getElementById('val-pm');
const sliderPm = document.getElementById('slider-pm');

// Outlet Mapping (Left Column)
const toggleCo2 = document.getElementById('toggle-co2');
const selectCo2 = document.getElementById('select-co2');
const toggleVoc = document.getElementById('toggle-voc');
const selectVoc = document.getElementById('select-voc');
const togglePm = document.getElementById('toggle-pm');
const selectPm = document.getElementById('select-pm');

// Buttons
const btnSave = document.getElementById('btn-save');
const btnRecal = document.getElementById('btn-recal');

// --- 1. FETCH LIVE SETTINGS FROM FIREBASE ---
onValue(ref(db, `${BASE_PATH}/settings`), (snapshot) => {
  const settings = snapshot.val();
  if (!settings) return;

  // Update Threshold Sliders & Text
  if (settings.co2Threshold !== undefined) {
    sliderCo2.value = settings.co2Threshold;
    valCo2.innerHTML = `${settings.co2Threshold} <span>ppm</span>`;
  }
  if (settings.vocThreshold !== undefined) {
    sliderVoc.value = settings.vocThreshold;
    valVoc.innerHTML = `${settings.vocThreshold} <span>idx</span>`;
  }
  if (settings.pm25Threshold !== undefined) {
    sliderPm.value = settings.pm25Threshold;
    valPm.innerHTML = `${settings.pm25Threshold} <span>µg/m³</span>`;
  }

  // Update Toggles (Checkboxes)
  if (settings.co2Toggle !== undefined) toggleCo2.checked = settings.co2Toggle;
  if (settings.vocToggle !== undefined) toggleVoc.checked = settings.vocToggle;
  if (settings.pm25Toggle !== undefined) togglePm.checked = settings.pm25Toggle;

  // Update Dropdowns
  if (settings.co2Outlet !== undefined) selectCo2.value = settings.co2Outlet;
  if (settings.vocOutlet !== undefined) selectVoc.value = settings.vocOutlet;
  if (settings.pm25Outlet !== undefined) selectPm.value = settings.pm25Outlet;
});

// --- 2. UPDATE TEXT INSTANTLY WHEN DRAGGING SLIDERS ---
sliderCo2.addEventListener('input', (e) => {
    valCo2.innerHTML = `${e.target.value} <span>ppm</span>`;
});
sliderVoc.addEventListener('input', (e) => {
    valVoc.innerHTML = `${e.target.value} <span>idx</span>`;
});
sliderPm.addEventListener('input', (e) => {
    valPm.innerHTML = `${e.target.value} <span>µg/m³</span>`;
});

// --- 3. SAVE ALL CONFIGURATIONS TO FIREBASE ---
btnSave.addEventListener('click', () => {
    const originalText = btnSave.innerHTML;
    btnSave.innerText = "Saving...";
    btnSave.style.opacity = "0.7";

    const newSettings = {
        co2Threshold: parseInt(sliderCo2.value),
        vocThreshold: parseInt(sliderVoc.value),
        pm25Threshold: parseInt(sliderPm.value),
        
        co2Toggle: toggleCo2.checked,
        vocToggle: toggleVoc.checked,
        pm25Toggle: togglePm.checked,

        co2Outlet: parseInt(selectCo2.value),
        vocOutlet: parseInt(selectVoc.value),
        pm25Outlet: parseInt(selectPm.value)
    };

    update(ref(db, `${BASE_PATH}/settings`), newSettings)
        .then(() => {
            btnSave.innerText = "Saved Successfully! ✓";
            btnSave.style.opacity = "1";
            setTimeout(() => { btnSave.innerHTML = originalText; }, 2000);
        })
        .catch((error) => {
            console.error("Error saving settings: ", error);
            btnSave.innerText = "Error Saving!";
            btnSave.style.opacity = "1";
            setTimeout(() => { btnSave.innerHTML = originalText; }, 2000);
        });
});

// --- 4. RECALIBRATION BUTTON COMMAND ---
btnRecal.addEventListener('click', () => {
    const originalText = btnRecal.innerHTML;
    btnRecal.innerText = "Sending Command...";
    
    update(ref(db, `${BASE_PATH}/controls`), { triggerRecalibration: true })
        .then(() => {
            btnRecal.innerText = "Recalibrating...";
            setTimeout(() => { btnRecal.innerHTML = originalText; }, 3000);
        });
});

// --- 5. HAMBURGER MENU TOGGLE FOR MOBILE VIEW ---
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