/**
 * @fileoverview Authentication Middleware
 * 
 * Provides authentication and authorization middleware for Express routes.
 * - requireAuth: Verifies Firebase ID token and attaches user to request
 * - requireReviewerRole: Ensures authenticated user has "reviewer" role
 */

const { admin } = require('../utils/firebase');

/**
 * Verify user is authenticated with valid Firebase token.
 * Decodes JWT token and attaches user info to req.user.
 * 
 * @param {string} req.headers.authorization - Bearer token from Firebase Auth
 * @returns {void} Attaches req.user = { uid, email, role } and calls next()
 * @throws {401} No token provided or invalid token
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token' });
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'applicant'
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Verify user has "reviewer" role.
 * Must be used after requireAuth middleware.
 * 
 * @param {Object} req.user - User object from requireAuth middleware
 * @param {string} req.user.role - User's role from Firebase custom claims
 * @returns {void} Calls next() if user is reviewer
 * @throws {403} User does not have reviewer role
 */
function requireReviewerRole(req, res, next) {
  if (!req.user || req.user.role !== 'reviewer') {
    return res.status(403).json({ success: false, error: 'Reviewer access required' });
  }
  next();
}

module.exports = { requireAuth, requireReviewerRole };