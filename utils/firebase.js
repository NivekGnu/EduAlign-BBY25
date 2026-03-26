// Initializes Firebase Admin SDK for server-side access to:
// - Firestore (database for application records)
// - Cloud Storage (file storage for PDFs and Excel files)
//
// Configuration loaded from environment variables:
// - FIREBASE_PROJECT_ID: Google Cloud project ID
// - FIREBASE_CLIENT_EMAIL: Service account email
// - FIREBASE_PRIVATE_KEY: Service account private key
// - FIREBASE_STORAGE_BUCKET: Storage bucket name

const admin = require('firebase-admin');
require('dotenv').config(); // Loads the environment variables from .env file

// Initialize Firebase Admin SDK
// It uses service account credentials from environment variables.
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    // Storage bucket for file uploads (PDFs and Excel files)
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
  
  console.log('Firebase initialized successfully');
  console.log(`Storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);
} catch (error) {
  // Log error and exit if Firebase fails to initialize
  // The application cannot function without Firebase
  console.error('Firebase initialization error:', error.message);
  process.exit(1);
}

// Firestore database instance
const db = admin.firestore();

// Cloud Storage bucket instance which is to
// store PDF curricula and generated Excel files
const storage = admin.storage().bucket();

// FieldValue utility
// Provides special values like serverTimestamp() for Firestore
const FieldValue = admin.firestore.FieldValue;

// Export all Firebase services for use in other modules
module.exports = {
  admin,
  db,
  storage,
  FieldValue
};