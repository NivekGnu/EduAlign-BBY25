/**
 * @fileoverview Role Management CLI Script
 * 
 * Command-line utility to promote users from "applicant" to "reviewer" role.
 * This is the only way to grant reviewer access (cannot be done via API).
 * 
 * Usage: node utils/manageRole.js <email>
 * Example: node utils/manageRole.js admin@example.com
 * 
 * Security: Only run this script manually with admin access to server.
 */

const { admin } = require('./firebase');
require('dotenv').config();

const email = process.argv[2];

if (!email) {
  console.log('Usage: node utils/manageRole.js <email>');
  process.exit(1);
}

admin.auth().getUserByEmail(email)
  .then(user => admin.auth().setCustomUserClaims(user.uid, { role: 'reviewer' }))
  .then(() => console.log(`User associated with ${email} now has role: reviewer`))
  .catch(err => console.error('Error:', err.message))
  .finally(() => process.exit());