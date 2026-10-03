// ============================================================
//  firebase.js — Shared Firebase configuration for AeroCube
//  All pages import from this file so the config lives in
//  ONE place. Do NOT duplicate this config in other files.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase project configuration (AeroCube Realtime Database)
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

// Initialize Firebase services once
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// The base Firebase path for aerocube_01
const BASE_PATH = "/Aerocubes/aerocube_01";

// Export everything other scripts need
export { app, db, auth, BASE_PATH };
