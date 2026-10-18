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
const savedAeroCubeId = localStorage.getItem('aerocube-id') || BASE_PATH.split('/').pop();
const aeroplugPath = '/aeroplugs/' + (localStorage.getItem('aeroplug-id') || 'plug_01');
const controlsPath = '/Aerocubes/' + savedAeroCubeId + '/controls';

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
const modeFeedback = document.getElementById('mode-feedback');
const reportedStateFeedback = document.getElementById('reported-state-feedback');
const relayFeedback = {
  manualRelay1: document.getElementById('feedback-relay1'),
  manualRelay2: document.getElementById('feedback-relay2')
};

let controlsLoaded = false;
let modePending = false;
const pendingRelays = new Set();
const savedControls = { isAutoMode: null, manualRelay1: null, manualRelay2: null };
const reportedRelays = { relay1: null, relay2: null };

function setFeedback(element, message, state = '') {
  if (!element) return;
  element.textContent = message;
  element.className = 'control-feedback' + (state ? ' ' + state : '');
}

function renderControls() {
  const automatic = savedControls.isAutoMode === true;
  const manual = savedControls.isAutoMode === false;
  const busy = modePending || pendingRelays.size > 0;

  btnAuto?.classList.toggle('active', automatic);
  btnManual?.classList.toggle('active', manual);
  btnAuto?.setAttribute('aria-pressed', String(automatic));
  btnManual?.setAttribute('aria-pressed', String(manual));
  if (btnAuto) btnAuto.disabled = !controlsLoaded || busy;
  if (btnManual) btnManual.disabled = !controlsLoaded || busy;
  autoModeInfo?.classList.toggle('hidden', !automatic);
  manualModeInfo?.classList.toggle('hidden', !manual);

  for (const [input, request, relay] of [
    [switchRelay1, 'manualRelay1', 'relay1'],
    [switchRelay2, 'manualRelay2', 'relay2']
  ]) {
    if (!input) continue;
    const value = manual ? savedControls[request] : reportedRelays[relay];
    input.checked = value === true;
    input.indeterminate = typeof value !== 'boolean';
    input.disabled = !controlsLoaded || !manual || busy;
  }
}

function renderReportedState() {
  for (const [element, relay] of [[textRelay1, 'relay1'], [textRelay2, 'relay2']]) {
    if (!element) continue;
    const value = reportedRelays[relay];
    element.innerText = 'Reported: ' + (typeof value === 'boolean' ? (value ? 'ON' : 'OFF') : 'Unknown');
  }
  renderControls();
}

renderControls();

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

onValue(ref(db, aeroplugPath + '/metadata'), (snapshot) => {
  const metadata = snapshot.val();
  const lastSeen = metadata?.lastSeen ?? metadata?.lastseen ?? metadata?.['lastSeen:'];
  updateAeroplugStatus(lastSeen);
});

setInterval(() => updateAeroplugStatus(aeroplugLastSeenTimestamp), 15000);

// --- LISTEN FOR AEROPLUG RELAY STATE ---
onValue(ref(db, aeroplugPath + '/state'), (snapshot) => {
  const state = snapshot.val() || {};
  for (const relay of ['relay1', 'relay2']) {
    reportedRelays[relay] = typeof state[relay] === 'boolean' ? state[relay] : null;
  }
  setFeedback(reportedStateFeedback, '');
  renderReportedState();
}, (error) => {
  reportedRelays.relay1 = null;
  reportedRelays.relay2 = null;
  renderReportedState();
  setFeedback(reportedStateFeedback, 'Could not load AeroPlug\'s reported outlet states: ' + error.message, 'error');
});

// --- LISTEN FOR CONTROLS ---
onValue(ref(db, controlsPath), (snapshot) => {
  const controls = snapshot.val() || {};
  controlsLoaded = true;
  for (const key of ['isAutoMode', 'manualRelay1', 'manualRelay2']) {
    savedControls[key] = typeof controls[key] === 'boolean' ? controls[key] : null;
  }
  if (savedControls.isAutoMode === null) {
    setFeedback(modeFeedback, 'Choose an operating mode to enable manual requests.');
  } else if (!modePending && !modeFeedback?.classList.contains('success') && !modeFeedback?.classList.contains('error')) {
    setFeedback(modeFeedback, '');
  }
  renderControls();
}, (error) => {
  controlsLoaded = false;
  savedControls.isAutoMode = null;
  renderControls();
  setFeedback(modeFeedback, 'Could not load the saved operating mode: ' + error.message, 'error');
});

// AeroCube applies these requests; only AeroPlug's reported state confirms an output.
async function updateMode(isAutoMode) {
  if (typeof isAutoMode !== 'boolean' || !controlsLoaded || modePending || pendingRelays.size || savedControls.isAutoMode === isAutoMode) return;
  const previousMode = savedControls.isAutoMode;
  modePending = true;
  setFeedback(modeFeedback, 'Saving operating mode to Firebase…');
  renderControls();
  try {
    await update(ref(db, controlsPath), { isAutoMode });
    savedControls.isAutoMode = isAutoMode;
    setFeedback(modeFeedback, 'Operating mode saved to Firebase. AeroCube will apply it on its next cycle.', 'success');
  } catch (error) {
    savedControls.isAutoMode = previousMode;
    setFeedback(modeFeedback, 'Could not save the operating mode: ' + error.message, 'error');
  } finally {
    modePending = false;
    renderControls();
  }
}

async function updateManualRelay(relay, value) {
  if (!Object.hasOwn(relayFeedback, relay) || typeof value !== 'boolean' ||
      !controlsLoaded || savedControls.isAutoMode !== false || modePending || pendingRelays.size) {
    renderControls();
    return;
  }
  const previousRequest = savedControls[relay];
  pendingRelays.add(relay);
  setFeedback(relayFeedback[relay], 'Saving manual request to Firebase…');
  renderControls();
  try {
    await update(ref(db, controlsPath), { [relay]: value });
    savedControls[relay] = value;
    setFeedback(relayFeedback[relay], 'Manual request saved to Firebase. Check the reported state for the outlet response.', 'success');
  } catch (error) {
    savedControls[relay] = previousRequest;
    setFeedback(relayFeedback[relay], 'Could not save the manual request: ' + error.message, 'error');
  } finally {
    pendingRelays.delete(relay);
    renderControls();
  }
}

btnAuto?.addEventListener('click', () => updateMode(true));
btnManual?.addEventListener('click', () => updateMode(false));
switchRelay1?.addEventListener('change', (e) => updateManualRelay('manualRelay1', e.target.checked));
switchRelay2?.addEventListener('change', (e) => updateManualRelay('manualRelay2', e.target.checked));
