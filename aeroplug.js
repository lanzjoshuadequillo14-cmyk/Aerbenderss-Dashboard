// ============================================================
//  aeroplug.js — AeroPlug control page logic
// ============================================================

import { db, auth, BASE_PATH } from './firebase.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
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
const aeroplugPath = '/aeroplugs/' + (localStorage.getItem('aeroplug-id') || 'plug_01');

menuToggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

// --- DOM ELEMENTS ---
const btnAuto = document.getElementById('btn-auto');
const btnManual = document.getElementById('btn-manual');
const switchRelay1 = document.getElementById('switch-relay1');
const switchRelay2 = document.getElementById('switch-relay2');
const textRelay1 = document.getElementById('text-relay1');
const textRelay2 = document.getElementById('text-relay2');
const autoModeInfo = document.getElementById('auto-mode-info');
const manualModeInfo = document.getElementById('manual-mode-info');
const aeroplugIndicator = document.getElementById('aeroplug-indicator');
const aeroplugOnlineText = document.getElementById('aeroplug-online-text');
const aeroplugLastSeen = document.getElementById('aeroplug-last-seen');

// --- LISTEN FOR AEROPLUG STATUS ---
let aeroplugLastSeenTimestamp = null;

function checkDeviceOnline(lastSeen) {
  if (!lastSeen) return false;
  return Math.floor((Date.now() - lastSeen) / 1000) < 60;
}

function timeAgo(timestamp) {
  if (!timestamp) return '--';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return diff + ' seconds ago';
  if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
  return Math.floor(diff / 86400) + ' days ago';
}

function updateAeroplugStatus(lastSeen) {
  aeroplugLastSeenTimestamp = lastSeen || null;
  const online = checkDeviceOnline(aeroplugLastSeenTimestamp);
  aeroplugIndicator.className = 'aeroplug-indicator ' + (online ? 'online' : 'offline');
  aeroplugOnlineText.className = 'aeroplug-online-text ' + (online ? 'online' : 'offline');
  aeroplugOnlineText.innerText = online ? 'Online' : 'Offline';
  aeroplugLastSeen.innerText = aeroplugLastSeenTimestamp
    ? 'Last data received: ' + timeAgo(aeroplugLastSeenTimestamp)
    : 'Last data received: --';
}

onValue(ref(db, aeroplugPath), (snapshot) => {
  const plugData = snapshot.val();
  updateAeroplugStatus(plugData ? plugData.lastSeen : null);
});

setInterval(() => updateAeroplugStatus(aeroplugLastSeenTimestamp), 15000);

// --- LISTEN FOR CONTROLS ---
onValue(ref(db, BASE_PATH + '/controls'), (snapshot) => {
  const controls = snapshot.val();
  if (!controls) return;

  if (controls.isAutoMode !== undefined) {
    if (controls.isAutoMode) {
      btnAuto?.classList.add('active');
      btnManual?.classList.remove('active');
      if (switchRelay1) switchRelay1.disabled = true;
      if (switchRelay2) switchRelay2.disabled = true;
      autoModeInfo?.classList.remove('hidden');
      manualModeInfo?.classList.add('hidden');
    } else {
      btnManual?.classList.add('active');
      btnAuto?.classList.remove('active');
      if (switchRelay1) switchRelay1.disabled = false;
      if (switchRelay2) switchRelay2.disabled = false;
      autoModeInfo?.classList.add('hidden');
      manualModeInfo?.classList.remove('hidden');
    }
  }

  if (controls.manualRelay1 !== undefined && switchRelay1) {
    switchRelay1.checked = controls.manualRelay1;
    textRelay1.innerText = controls.manualRelay1 ? 'ON' : 'OFF';
  }
  if (controls.manualRelay2 !== undefined && switchRelay2) {
    switchRelay2.checked = controls.manualRelay2;
    textRelay2.innerText = controls.manualRelay2 ? 'ON' : 'OFF';
  }
});

// --- WRITE CONTROLS ---
function updateControls(partialState) {
  update(ref(db, BASE_PATH + '/controls'), partialState);
}

btnAuto?.addEventListener('click', () => updateControls({ isAutoMode: true }));
btnManual?.addEventListener('click', () => updateControls({ isAutoMode: false }));
switchRelay1?.addEventListener('change', (e) => updateControls({ manualRelay1: e.target.checked }));
switchRelay2?.addEventListener('change', (e) => updateControls({ manualRelay2: e.target.checked }));
