// Import Firebase core, Authentication, Analytics, and Realtime Database modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your exact web app's Firebase configuration
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
const db = getDatabase(app);

// Target DOM Elements
const formRegister = document.getElementById('form-register');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const registerConfirm = document.getElementById('register-confirm');
const registerRole = document.getElementById('register-role');
const registerError = document.getElementById('register-error');

// Password Visibility Toggle Elements
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const toggleConfirmBtn = document.getElementById('toggle-confirm-btn');

// Show/Hide Password Logic for Field 1
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    const type = registerPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    registerPassword.setAttribute('type', type);
    
    // Switch icon visual (optional enhancement)
    togglePasswordBtn.innerHTML = type === 'text' 
      ? '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>' 
      : '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
    lucide.createIcons();
  });
}

// Show/Hide Password Logic for Field 2 (Confirm Password)
if (toggleConfirmBtn) {
  toggleConfirmBtn.addEventListener('click', () => {
    const type = registerConfirm.getAttribute('type') === 'password' ? 'text' : 'password';
    registerConfirm.setAttribute('type', type);
    
    toggleConfirmBtn.innerHTML = type === 'text' 
      ? '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>' 
      : '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
    lucide.createIcons();
  });
}

// Listen for the form submission
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault(); 
  
  if (registerError) registerError.innerText = 'Creating account...';

  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  const confirmPassword = registerConfirm.value;
  const role = registerRole.value;

  if (password !== confirmPassword) {
      registerError.innerText = "Passwords do not match.";
      return; 
  }

  if (!role) {
      registerError.innerText = "Please select an account role.";
      return;
  }

  try {
    // 1. Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save the user's role in the Realtime Database under /users/{uid}
    await set(ref(db, 'users/' + user.uid), {
      email: email,
      role: role 
    });

    // 3. Sign the user out immediately so they have to manually log in
    await signOut(auth);

    // 4. Redirect to the Login page
    window.location.href = 'Login.html';

  } catch (err) {
    console.error("Registration error:", err);
    
    if (registerError) {
        if (err.code === 'auth/email-already-in-use') {
            registerError.innerText = "An account with this email already exists.";
        } else if (err.code === 'auth/weak-password') {
            registerError.innerText = "Password must be exactly 6 characters.";
        } else {
            registerError.innerText = "Error: " + err.message; 
        }
    }
  }
});