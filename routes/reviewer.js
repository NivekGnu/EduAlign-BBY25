const express = require('express');
const router = express.Router();
const reviewerController = require('../controllers/reviewerController');
const { requireAuth, requireEmployee } = require('../middleware/auth');

// Routes - require employee authentication
router.post('/login', reviewerController.login);  // Keep for backward compatibility
router.post('/applications', requireAuth, requireEmployee, reviewerController.getApplications);
router.get('/applications/:id', requireAuth, requireEmployee, reviewerController.getApplicationDetails);
router.patch('/applications/:id/status', requireAuth, requireEmployee, reviewerController.updateStatus);
router.get('/applications/:id/pdf/:version', requireAuth, requireEmployee, reviewerController.getPdfUrl);

module.exports = router;