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
router.post('/submit', requireAuth, upload.single('pdf'), applicationController.submitApplication); // submits an applicant's application
// router.post('/revise/:id', upload.single('pdf'), applicationController.reviseApplication); // may use later -clinton
router.get('/my-applications', requireAuth, applicationController.getMyApplications); // allow applicant to view all their applications
router.get('/my-applications/:id', requireAuth, applicationController.getMyApplicationDetails); // allow applicant to see details about their application

module.exports = router;