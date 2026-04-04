/**
 * @fileoverview Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin SDK for server-side access to:
 * - Firestore (NoSQL database for application records)
 * - Cloud Storage (file storage for PDFs and Excel files)
 * - Authentication (user management and custom claims)
 * 
 * Configuration loaded from environment variables:
 * - FIREBASE_PROJECT_ID: Google Cloud project ID
 * - FIREBASE_CLIENT_EMAIL: Service account email
 * - FIREBASE_PRIVATE_KEY: Service account private key (replace \n with newlines)
 * - FIREBASE_STORAGE_BUCKET: Storage bucket name
 * 
 * Exits process if Firebase initialization fails (app cannot function without it).
 */

const admin = require('firebase-admin');
require('dotenv').config(); // Loads the environment variables from .env file

// Initialize Firebase Admin SDK with service account credentials
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
  
  console.log('Firebase initialized successfully');
  console.log(`Storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  process.exit(1);
}

/**
 * Firestore database instance.
 * Used for storing application records with version history.
 */
const db = admin.firestore();

/**
 * Cloud Storage bucket instance.
 * Used for storing PDF curricula and generated Excel files.
 * File structure: applications/{applicationId}/{timestamp}_{filename}
 */
const storage = admin.storage().bucket();

/**
 * Firestore FieldValue utility.
 * Provides special values like serverTimestamp() for database operations.
 */
const FieldValue = admin.firestore.FieldValue;

module.exports = {
  admin,
  db,
  storage,
  FieldValue
};