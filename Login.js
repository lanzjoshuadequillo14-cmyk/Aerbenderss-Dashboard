// Import Firebase core, Authentication, and Analytics modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your complete web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Target DOM Elements
const formLogin = document.getElementById('form-login');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// Listen for the form submission
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevents the page from refreshing
  
  // Display a loading state
  if (loginError) loginError.innerText = 'Authenticating...';

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  try {
    // 1. Authenticate user with Firebase
    await signInWithEmailAndPassword(auth, email, password);

    // 2. SUCCESS! Redirect to the main Dashboard (index.html)
    window.location.href = 'index.html';

  } catch (err) {
    // 3. If it fails (wrong password, user not found, etc.), show an error
    console.error("Login error:", err);
    
    if (loginError) {
        if (err.code === 'auth/invalid-credential') {
            loginError.innerText = "Invalid email or password.";
        } else {
            loginError.innerText = "Error: " + err.message; 
        }
    }
  }
});