/**
 * @fileoverview Application Routes
 * 
 * Defines all applicant-facing API endpoints for curriculum application system.
 * All routes require authentication via requireAuth middleware.
 * 
 * Routes:
 * - POST /analyze - Preview curriculum analysis without saving
 * - POST /submit - Submit new application with curriculum and package files
 * - POST /revise/:id - Add new version to existing application
 * - GET /my-applications - Get all user's applications
 * - GET /my-applications/:id - Get detailed application with version history
 * 
 * File upload configuration:
 * - Max file size: 10MB (configurable via MAX_FILE_SIZE_MB env var)
 * - Allowed type: PDF only
 * - Max curriculum files: 10
 * - Required package files: 3 (Provider Form, Course Outline, Admin Doc)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const applicationController = require('../controllers/applicationController');
const { requireAuth } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 // Default 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});


/**
 * POST /api/applications/analyze
 * Analyze curriculum PDFs without saving to database (preview mode).
 * Returns AI analysis with competency mappings.
 */
router.post('/analyze', requireAuth, upload.array('pdfs', 10), applicationController.analyzeCurriculum);

/**
 * POST /api/applications/submit
 * Submit new application with curriculum and package files.
 * Creates application record, runs AI analysis, generates Excel.
 * 
 * Required files:
 * - pdfs: 1-10 curriculum PDF files
 * - applicationPackageFiles: Exactly 3 PDFs (Provider Form, Course Outline, Admin Doc)
 */
router.post('/submit', requireAuth, upload.fields([
  { name: 'pdfs', maxCount: 10 },
  { name: 'applicationPackageFiles', maxCount: 3 }
]), applicationController.submitApplication);

/**
 * POST /api/applications/revise/:id
 * Add new version to existing application with revised curriculum.
 * Preserves all previous versions in version history.
 * 
 * Required files:
 * - pdfs: 1-10 curriculum PDF files
 * - applicationPackageFiles: Exactly 3 PDFs (Provider Form, Course Outline, Admin Doc)
 */
router.post('/revise/:id', requireAuth, upload.fields([
  { name: 'pdfs', maxCount: 10 },
  { name: 'applicationPackageFiles', maxCount: 3 }
]), applicationController.reviseApplication);

/**
 * GET /api/applications/my-applications
 * Get all applications for authenticated user.
 */
router.get('/my-applications', requireAuth, applicationController.getMyApplications); // allow applicant to view all their applications

/**
 * GET /api/applications/my-applications/:id
 * Get detailed application with all versions and signed download URLs.
 * Only accessible by application owner.
 */
router.get('/my-applications/:id', requireAuth, applicationController.getMyApplicationDetails); // allow applicant to see details about their application

module.exports = router;