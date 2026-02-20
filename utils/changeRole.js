// this code is only used in the terminal
// allows us to change a user's role from applicant to reviewer

const { admin } = require('./firebase');
require('dotenv').config();

const email = process.argv[2];

if (!email) {
  console.log('Usage: node utils/changeRole.js <email>');
  process.exit(1);
}

admin.auth().getUserByEmail(email)
  .then(user => admin.auth().setCustomUserClaims(user.uid, { role: 'reviewer' }))
  .then(() => console.log(`${email} promoted to reviewer`))
  .catch(err => console.error('Error:', err.message))
  .finally(() => process.exit());