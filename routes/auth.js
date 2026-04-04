/**
 * @fileoverview Authentication Routes
 * 
 * Defines authentication-related API endpoints.
 * Currently only handles setting default user role after signup.
 * 
 * Routes:
 * - POST /set-role - Set user role to "applicant" (default for new users)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/auth/set-role
 * Set user role to "applicant" (default for new users).
 * Called after user signup to assign default role via Firebase custom claims.
 */
router.post('/set-role', authController.setUserRole); // sets user's role to default

module.exports = router;