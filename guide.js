import { auth } from './firebase.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = 'Registration.html';
});

document.getElementById('btn-logout')?.addEventListener('click', async (event) => {
  event.preventDefault();
  try {
    await signOut(auth);
    window.location.href = 'Registration.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
});

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

menuToggle?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
});

overlay?.addEventListener('click', () => {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('active');
});
