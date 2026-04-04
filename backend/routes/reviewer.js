/**
 * @fileoverview Reviewer Routes
 * 
 * Defines all reviewer-facing API endpoints for application review system.
 * All routes require authentication + reviewer role (enforced by middleware).
 * 
 * Routes:
 * - GET /applications - Get all submitted applications with statistics
 * - GET /applications/:id - Get detailed application with all versions
 * - PATCH /applications/:id/status - Update application status
 */

const express = require('express');
const router = express.Router();
const reviewerController = require('../controllers/reviewerController');
const { requireAuth, requireReviewerRole } = require('../middleware/auth');

/**
 * GET /api/reviewer/applications
 * Get all submitted applications with dashboard statistics.
 * Returns applications count by status (Unreviewed, Incomplete, Approved).
 */
router.get('/applications', requireAuth, requireReviewerRole, reviewerController.getApplications);

/**
 * GET /api/reviewer/applications/:id
 * Get detailed application with all versions and signed download URLs.
 * Includes curriculum files, package files, and generated Excel for each version.
 */
router.get('/applications/:id', requireAuth, requireReviewerRole, reviewerController.getApplicationDetails);

/**
 * PATCH /api/reviewer/applications/:id/status
 * Update application status.
 * Valid statuses: "Unreviewed" | "Incomplete" | "Approved"
 * Sets reviewedDate timestamp when status is "Approved".
 */
router.patch('/applications/:id/status', requireAuth, requireReviewerRole, reviewerController.updateStatus);

module.exports = router;