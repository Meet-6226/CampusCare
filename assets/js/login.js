import { firebaseConfig } from "./firebase-Config.js";
import FCMService from "./fcm-service.js";

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const ROLE_KEY = 'campuscareRole';
const LOGIN_TS_KEY = 'campuscareLoggedInAt';
const USER_ID_KEY = 'campuscareRoll';

const loginForm = document.getElementById('login-form');
const rollInput = document.getElementById('login-roll');
const passwordInput = document.getElementById('login-password');
const submitButton = document.getElementById('login-submit');
const errorMessage = document.getElementById('login-error');

const showError = (message) => {
  if (!errorMessage) return;
  errorMessage.textContent = message || 'Invalid credentials. Please try again.';
  errorMessage.style.display = 'block';
};

const hideError = () => {
  if (!errorMessage) return;
  errorMessage.style.display = 'none';
};

const normalizeRole = (typeValue) => {
  if (!typeValue) return 'user';
  const normalized = String(typeValue).trim().toLowerCase();
  return normalized === 'admin' ? 'admin' : 'user';
};

const redirectForRole = (role) => {
  const destination = role === 'admin' ? 'admin/admin-dashboard.html' : 'user/user-dashboard.html';
  window.location.href = destination;
};

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const roll = rollInput?.value?.trim();
    const password = passwordInput?.value?.trim();

    if (!roll || !password) {
      showError('Please enter both roll number and password.');
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('is-loading');
      }

      const usersRef = db.collection('users');

      let snapshot = await usersRef
        .where('RollNo', '==', roll)
        .limit(1)
        .get();

      if (snapshot.empty) {
        const numericRoll = Number(roll);
        if (!Number.isNaN(numericRoll)) {
          snapshot = await usersRef
            .where('RollNo', '==', numericRoll)
            .limit(1)
            .get();
        }
      }

      if (snapshot.empty) {
        showError('No matching account found for this roll number.');
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (!data || data.password !== password) {
        showError('Incorrect password. Please try again.');
        return;
      }

      const role = normalizeRole(data.type);

      localStorage.setItem(ROLE_KEY, role);
      localStorage.setItem(LOGIN_TS_KEY, Date.now().toString());
      localStorage.setItem(USER_ID_KEY, roll);

      // Initialize FCM service after successful login
      try {
        await window.fcmService.initialize();
        console.log('FCM service initialized for user:', roll);
      } catch (fcmError) {
        console.warn('FCM initialization failed:', fcmError);
        // Don't block login if FCM fails
      }

      redirectForRole(role);
    } catch (error) {
      console.error('Login error:', error);
      showError('Unable to sign in right now. Please try again shortly.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('is-loading');
      }
    }
  });
}
