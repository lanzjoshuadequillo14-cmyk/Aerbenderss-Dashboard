import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginForm = document.getElementById('form-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.innerText = '';

  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Login error:', error);
    loginError.innerText = 'Invalid email or password.';
  }
});