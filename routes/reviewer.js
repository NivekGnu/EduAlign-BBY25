const express = require('express');
const router = express.Router();
const reviewerController = require('../controllers/reviewerController');
const { requireAuth, requireReviewerRole } = require('../middleware/auth');

// Routes - require authentication with reviewer role
router.post('/login', reviewerController.login);  // Keep for backward compatibility
router.post('/applications', requireAuth, requireReviewerRole, reviewerController.getApplications);
router.get('/applications/:id', requireAuth, requireReviewerRole, reviewerController.getApplicationDetails);
router.patch('/applications/:id/status', requireAuth, requireReviewerRole, reviewerController.updateStatus);
router.get('/applications/:id/pdf/:version', requireAuth, requireReviewerRole, reviewerController.getPdfUrl);

module.exports = router;