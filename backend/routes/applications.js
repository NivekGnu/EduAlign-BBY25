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
 * - Max file size: MAX_FILE_SIZE_MB (10MB)
 * - Allowed type: PDF only
 * - Max curriculum files: MAX_CURRICULUM_FILES (10)
 * - Required package files: APPLICATION_PACKAGE_FILES (3)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const applicationController = require('../controllers/applicationController');
const { requireAuth } = require('../middleware/auth');
const { MAX_FILE_SIZE_MB, MAX_CURRICULUM_FILES, APPLICATION_PACKAGE_FILES } = require('../config/constants');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 // convert to bytes
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
router.post('/analyze', requireAuth, upload.array('pdfs', MAX_CURRICULUM_FILES), applicationController.analyzeCurriculum);

/**
 * POST /api/applications/submit
 * Submit new application with curriculum and package files.
 * Creates application record, runs AI analysis, generates Excel.
 * 
 * Required files:
 * - pdfs: 1 to MAX_CURRICULUM_FILES curriculum PDF files
 * - applicationPackageFiles: Exactly APPLICATION_PACKAGE_FILES PDFs (Provider Form, Course Outline, Administration Document)
 */
router.post('/submit', requireAuth, upload.fields([
  { name: 'pdfs', maxCount: MAX_CURRICULUM_FILES },
  { name: 'applicationPackageFiles', maxCount: APPLICATION_PACKAGE_FILES }
]), applicationController.submitApplication);

/**
 * POST /api/applications/revise/:id
 * Add new version to existing application with revised curriculum.
 * Preserves all previous versions in version history.
 * 
 * Required files:
 * - pdfs: 1 to MAX_CURRICULUM_FILES curriculum PDF files
 * - applicationPackageFiles: Exactly APPLICATION_PACKAGE_FILES PDFs (Provider Form, Course Outline, Administration Document)
 */
router.post('/revise/:id', requireAuth, upload.fields([
  { name: 'pdfs', maxCount: MAX_CURRICULUM_FILES },
  { name: 'applicationPackageFiles', maxCount: APPLICATION_PACKAGE_FILES }
]), applicationController.reviseApplication);

/**
 * GET /api/applications/my-applications
 * Get all applications for authenticated user.
 */
router.get('/my-applications', requireAuth, applicationController.getMyApplications);

/**
 * GET /api/applications/my-applications/:id
 * Get detailed application with all versions and signed download URLs.
 * Only accessible by application owner.
 */
router.get('/my-applications/:id', requireAuth, applicationController.getMyApplicationDetails);

module.exports = router;