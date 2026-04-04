/**
 * @fileoverview Authentication Controller
 * 
 * Manages user role assignment via Firebase custom claims.
 * Default role is "applicant". To promote to "reviewer", use utils/manageRole.js script.
 */

const { admin } = require('../utils/firebase');

/**
 * Set user role to "applicant" (default for new users).
 * 
 * @param {string} req.body.uid - Firebase user UID
 * @returns {{ success: boolean, role: string }} Success response with assigned role
 * @throws {400} UID not provided
 * @throws {500} Firebase Auth operation failure
 */
exports.setUserRole = async (req, res) => {
  try {
    const { uid } = req.body;
    
    if (!uid) {
      return res.status(400).json({ success: false, error: 'UID required' });
    }
    
    const userRecord = await admin.auth().getUser(uid);
    
    // Everyone gets "applicant" role by default
    await admin.auth().setCustomUserClaims(uid, { role: 'applicant' });
    
    console.log(`New user: ${userRecord.email} → applicant`);
    
    res.json({ success: true, role: 'applicant' });
  } catch (error) {
    console.error('Error setting role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
