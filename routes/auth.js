// Authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/set-role', authController.setUserRole);
// router.get('/me', requireAuth, authController.getUserInfo);

module.exports = router;