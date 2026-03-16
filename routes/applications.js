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

// Configure multer for package file uploads (uses 'packageFiles' field name)
const uploadPackage = multer({
  dest: 'uploads/',
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});


// Routes
// note max number of files is arbitrary. try 10 but may need to modify depending on LLM
router.post('/analyze', requireAuth, upload.array('pdfs', 10), applicationController.analyzeCurriculum); // analyze uploaded document only (does not save)
router.post('/create-draft', requireAuth, upload.array('pdfs', 10), applicationController.createDraft);               // Step 1: create draft with curriculum files
router.post('/:id/complete-package', requireAuth, uploadPackage.array('packageFiles', 3), applicationController.completePackage); // Step 2: complete package with additional files
router.post('/submit', requireAuth, upload.array('pdfs', 10), applicationController.submitApplication); // submits an applicant's application
router.post('/revise/:id', requireAuth, upload.array('pdfs', 10), applicationController.reviseApplication); // allow applicant to revise existing submitted application
router.get('/my-applications', requireAuth, applicationController.getMyApplications); // allow applicant to view all their applications
router.get('/my-applications/:id', requireAuth, applicationController.getMyApplicationDetails); // allow applicant to see details about their application

module.exports = router;