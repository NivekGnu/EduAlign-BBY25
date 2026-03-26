const express = require('express');
const router = express.Router();
const reviewerController = require('../controllers/reviewerController');
const { requireAuth, requireReviewerRole } = require('../middleware/auth');

// Routes - require authentication with reviewer role
router.get('/applications', requireAuth, requireReviewerRole, reviewerController.getApplications); // allow reviewer to see all applications
router.get('/applications/:id', requireAuth, requireReviewerRole, reviewerController.getApplicationDetails); // allow reviewer to see details of an application
router.patch('/applications/:id/status', requireAuth, requireReviewerRole, reviewerController.updateStatus); // update the status of an application

module.exports = router;