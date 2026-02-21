// Authentication middleware for routes
// for verifying user is logged in, or verifying user has reviewer role

const { admin } = require('../utils/firebase');

// requires user to be logged in
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

// requires user to have role reviewer
function requireReviewerRole(req, res, next) {
  if (!req.user || req.user.role !== 'reviewer') {
    return res.status(403).json({ success: false, error: 'Reviewer access required' });
  }
  next();
}

module.exports = { requireAuth, requireReviewerRole };