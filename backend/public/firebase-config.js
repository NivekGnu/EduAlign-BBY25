// /**
//  * @fileoverview Firebase Client SDK Configuration
//  * 
//  * Initializes Firebase SDK for client-side (browser) operations:
//  * - User authentication (sign up, log in, log out)
//  * - ID token generation for API requests
//  * - Firebase Auth state management
//  * 
//  * Note: This is the CLIENT-side config (uses apiKey).
//  * Server-side uses firebase.js with Admin SDK (uses service account).
//  * 
//  * Security: API keys in client-side code are safe - they identify the project,
//  * not authenticate users. Actual security enforced by Firebase Security Rules.
//  */

// const firebaseConfig = {
//   apiKey: "AIzaSyB5NOkb1AcoAW3oKj7IzJWNIVvXoJSAPjk", 
//   authDomain: "edualignai-3800.firebaseapp.com",
//   projectId: "edualignai-3800",
//   storageBucket: "edualignai-3800.firebasestorage.app",
//   messagingSenderId: "100283104152",
//   appId: "1:100283104152:web:758224f9e5e89d08c949ed"
// };

// firebase.initializeApp(firebaseConfig);