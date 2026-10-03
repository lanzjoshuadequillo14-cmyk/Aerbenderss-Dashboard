// ============================================================
//  maintenance.js — SPS30 sensor cleaning control
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
const aeroCubePath = '/Aerocubes/' + (localStorage.getItem('aerocube-id') || BASE_PATH.split('/').pop());

menuToggle?.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

// --- DOM ELEMENTS ---
const btnClean = document.getElementById('btn-sps30clean');
const textSps30Status = document.getElementById('text-sps30-status');
const modalConfirm = document.getElementById('modal-confirm');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');
let cleaningRequestStarted = false;

// --- LISTEN FOR SPS30 CLEAN STATE FROM FIREBASE ---
onValue(ref(db, aeroCubePath + '/settings/sps30Clean'), (snapshot) => {
  const isCleaning = snapshot.val();
  if (isCleaning === true) {
    textSps30Status.innerText = 'Cleaning in progress...';
    textSps30Status.style.color = 'var(--accent-yellow)';
    btnClean.disabled = true;
    btnClean.style.opacity = '0.6';
  } else {
    textSps30Status.innerText = 'Ready';
    textSps30Status.style.color = '#ffffff';
    btnClean.disabled = false;
    btnClean.style.opacity = '1';
  }
});

// --- SHOW CONFIRMATION MODAL ---
btnClean?.addEventListener('click', () => {
  cleaningRequestStarted = true;
  modalConfirm.style.display = 'flex';
});

// --- CANCEL ---
btnModalCancel?.addEventListener('click', () => {
  cleaningRequestStarted = false;
  modalConfirm.style.display = 'none';
});

// --- CONFIRM & SEND CLEANING COMMAND ---
btnModalConfirm?.addEventListener('click', () => {
  if (!cleaningRequestStarted) return;

  cleaningRequestStarted = false;
  modalConfirm.style.display = 'none';

  // Write true to sps30Clean — the ESP32 handles the actual cleaning
  update(ref(db, aeroCubePath + '/settings'), { sps30Clean: true })
    .then(() => {
      textSps30Status.innerText = 'Cleaning command sent!';
      textSps30Status.style.color = 'var(--accent-green)';
      // The ESP32 will reset sps30Clean to false when done
    })
    .catch((error) => {
      console.error("Error triggering SPS30 cleaning:", error);
      textSps30Status.innerText = 'Error sending command';
      textSps30Status.style.color = 'var(--accent-red)';
    });
});

// --- CLOSE MODAL ON OVERLAY CLICK ---
modalConfirm?.addEventListener('click', (e) => {
  if (e.target === modalConfirm) {
    cleaningRequestStarted = false;
    modalConfirm.style.display = 'none';
  }
});
