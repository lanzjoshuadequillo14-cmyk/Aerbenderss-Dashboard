import { auth } from './firebase.js';
import { 
  signInWithEmailAndPassword, 
  updatePassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const form = document.getElementById('form-change-password');
const emailInput = document.getElementById('cp-email');
const currentPasswordInput = document.getElementById('cp-current-password');
const newPasswordInput = document.getElementById('cp-new-password');
const confirmPasswordInput = document.getElementById('cp-confirm-password');
const statusDiv = document.getElementById('cp-status');

// Eye icon SVGs
const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;

// --- EYE TOGGLE LISTENERS ---
document.querySelectorAll('.toggle-password-btn').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.innerHTML = isPassword ? eyeOff : eyeOpen;
  });
});

// --- SUBMIT CHANGE PASSWORD ---
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusDiv.innerText = '';
  statusDiv.style.color = '#ef4444'; // Red for errors

  const email = emailInput.value.trim();
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    statusDiv.innerText = "New passwords do not match!";
    return;
  }

  try {
    // 1. Re-authenticate user credentials
    const userCredential = await signInWithEmailAndPassword(auth, email, currentPassword);
    
    // 2. Update password directly
    await updatePassword(userCredential.user, newPassword);

    statusDiv.style.color = '#10b981'; // Green
    statusDiv.innerText = 'Password updated successfully! Redirecting to login...';

    setTimeout(() => {
      window.location.href = 'Login.html';
    }, 2000);

  } catch (error) {
    console.error("Change password error:", error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      statusDiv.innerText = 'Incorrect email or current password.';
    } else {
      statusDiv.innerText = 'Failed to update password. Please try again.';
    }
  }
});