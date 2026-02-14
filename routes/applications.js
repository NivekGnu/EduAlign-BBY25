const express = require('express');
const router = express.Router();
const multer = require('multer');
const applicationController = require('../controllers/applicationController');

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
router.post('/submit', upload.single('pdf'), applicationController.submitApplication);
router.post('/revise/:id', upload.single('pdf'), applicationController.reviseApplication);
router.get('/:id', applicationController.getApplication);
router.get('/', applicationController.getAllApplications);

module.exports = router;
