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

// Routes
// note max number of files is arbitrary. try 10 but may need to modify depending on LLM
router.post('/analyze', requireAuth, upload.array('pdfs', 10), applicationController.analyzeCurriculum); // analyze uploaded document only (does not save)
// router.post('/submit', requireAuth, upload.array('pdfs', 10), applicationController.submitApplication);
router.post('/submit', requireAuth, upload.fields([ // submits an applicant's application
  { name: 'pdfs', maxCount: 10 },
  { name: 'applicationPackageFiles', maxCount: 3 }
]), applicationController.submitApplication);
// router.post('/revise/:id', requireAuth, upload.array('pdfs', 10), applicationController.reviseApplication);
router.post('/revise/:id', requireAuth, upload.fields([ // allow applicant to revise existing submitted application
  { name: 'pdfs', maxCount: 10 },
  { name: 'applicationPackageFiles', maxCount: 3 }
]), applicationController.reviseApplication);
router.get('/my-applications', requireAuth, applicationController.getMyApplications); // allow applicant to view all their applications
router.get('/my-applications/:id', requireAuth, applicationController.getMyApplicationDetails); // allow applicant to see details about their application

module.exports = router;