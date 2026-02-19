// const express = require('express');
// const router = express.Router();
// const reviewerController = require('../controllers/reviewerController');

// // Simple password authentication middleware
// function authenticate(req, res, next) {
//   const { password } = req.body;
  
//   if (password === process.env.REVIEWER_PASSWORD) {
//     next();
//   } else {
//     res.status(401).json({ 
//       success: false, 
//       error: 'Invalid password' 
//     });
//   }
// }

// // Routes -- KEEP ORDER
// router.post('/login', reviewerController.login);
// router.post('/applications', authenticate, reviewerController.getApplications);
// router.get('/applications/:id', reviewerController.getApplicationDetails); 
// router.patch('/applications/:id/status', authenticate, reviewerController.updateStatus);
// router.get('/applications/:id/pdf/:version', authenticate, reviewerController.getPdfUrl);

// module.exports = router; 

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