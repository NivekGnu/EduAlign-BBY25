const express = require('express'); // import express for node.js
const cors = require('cors'); // import crosss-origin resource sharing; allow API to accept requests from different domains
const path = require('path'); // import node.js path module
const rateLimit = require('express-rate-limit'); // import rate limiting middleware; prevent abuse of API (max request for given time from an IP address)
const reviewerRoutes = require('./routes/reviewer'); // import routes for reviewer later **TODO**
require('dotenv').config();

// Initialize Firebase
require('./utils/firebase');

// create an express application
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

// Rate limiting to prevent abuse
// limit requests per IP address
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 60, // Limit each IP to 60 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// use rateLimit
app.use(limiter);

// use cors
app.use(cors());

// body parsing
app.use(express.json({ limit: '15mb' })); // max file size is 10mb, add arbitrary 5mb for overhead (eg. form multipart)
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// use static file serving
// eg. /public/index.html → http://localhost:3000/index.html
app.use(express.static(path.join(__dirname, 'public')));

// use request logging
// logs all incoming requests with timestamp, method, and path (for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// API routes
// Method (eg. POST, GET) /api/applications/...
app.use('/api/applications', require('./routes/applications'));

// API routes as well
// Reviewer routes
// Method (eg. POST, GET) /api/reviewer/...
app.use('/api/reviewer', require('./routes/reviewer'));

// ============================================
// FRONTEND ROUTES
// Serve HTML pages for user interfaces
// ============================================

// index.html; training provider application form (main page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// reviewer.html; WorkSafeBC reviewer dashboard to review applications
app.get('/reviewer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reviewer.html'));
});

// ============================================
// ERROR HANDLING
// Catch-all handlers for undefined routes and errors
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// other errors or server error
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// start listening for incoming requests
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log(`Training Provider Application Server`);
  console.log('========================================');
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Provider Form: http://localhost:${PORT}`);
  console.log(`Reviewer Dashboard: http://localhost:${PORT}/reviewer`);
  console.log('========================================');
  console.log('');
});