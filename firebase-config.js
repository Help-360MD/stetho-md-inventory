/**
 * Firebase Configuration and Initialization for Stetho MD Clinic System
 * Connected to live Firebase Project: stetho-md-clinic
 */

const firebaseConfig = {
  apiKey: "AIzaSyAjPin8JgshXgYAok_MylmSQ9J0IjBjuXA",
  authDomain: "stetho-md-clinic.firebaseapp.com",
  projectId: "stetho-md-clinic",
  storageBucket: "stetho-md-clinic.firebasestorage.app",
  messagingSenderId: "170040359696",
  appId: "1:170040359696:web:cbf2b63bbdbc0991704395",
  measurementId: "G-HJR9GPQ5D4"
};

// Check if config is configured
const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

const getActiveFirebaseConfig = () => {
  return firebaseConfig;
};

// Initialize Firebase
let firebaseApp = null;
let db = null;
let auth = null;

function initFirebase() {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }
      db = firebase.firestore();
      auth = firebase.auth();
      
      // Enable offline persistence for uninterrupted clinic operations
      db.enablePersistence({ synchronizeTabs: true }).catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence failed: Multiple tabs open.');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence is not supported by this browser.');
        }
      });
      console.log('✅ Connected to live Firebase Firestore database: stetho-md-clinic');
      return true;
    }
  } catch (e) {
    console.error('Error initializing Firebase:', e);
    return false;
  }
}

initFirebase();
