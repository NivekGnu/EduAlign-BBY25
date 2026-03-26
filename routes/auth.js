// Authentication routes

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/set-role', authController.setUserRole); // sets user's role to default

module.exports = router;