// Authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/set-role', authController.setUserRole);

module.exports = router;