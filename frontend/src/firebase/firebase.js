/**
 * @fileoverview Firebase Client SDK Configuration
 * 
 * Initializes Firebase SDK for client-side (browser) authentication.
 * Exports auth instance for use in React components (login, signup, logout).
 * 
 * Note: This is CLIENT-side config (uses apiKey).
 * Server-side uses backend/utils/firebase.js with Admin SDK (service account).
 * 
 * Security: API keys in client code are safe - they identify the project,
 * not authenticate users. Actual security enforced by Firebase Security Rules.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Firebase project configuration.
 * Contains public identifiers for connecting to Firebase services.
 * 
 * @type {Object}
 * @property {string} apiKey - Public API key (safe to expose in browser)
 * @property {string} authDomain - Firebase Auth domain
 * @property {string} projectId - Firebase project ID
 * @property {string} storageBucket - Cloud Storage bucket name
 * @property {string} messagingSenderId - Firebase Cloud Messaging sender ID
 * @property {string} appId - Firebase app identifier
 */
const firebaseConfig = {
    
  apiKey: "AIzaSyB5NOkb1AcoAW3oKj7IzJWNIVvXoJSAPjk", 
  authDomain: "edualignai-3800.firebaseapp.com",
  projectId: "edualignai-3800",
  storageBucket: "edualignai-3800.firebasestorage.app",
  messagingSenderId: "100283104152",
  appId: "1:100283104152:web:758224f9e5e89d08c949ed"
};

/**
 * Initialized Firebase app instance.
 * @type {FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication instance.
 * Used for user authentication operations:
 * - signInWithEmailAndPassword()
 * - createUserWithEmailAndPassword()
 * - signOut()
 * - onAuthStateChanged()
 * 
 * @type {Auth}
 * @example
 * import { auth } from './firebase/firebase';
 * import { signInWithEmailAndPassword } from 'firebase/auth';
 * 
 * await signInWithEmailAndPassword(auth, email, password);
 */
export const auth = getAuth(app);