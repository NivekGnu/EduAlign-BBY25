/**
 * @fileoverview Express Server Entry Point
 * 
 * Main server file for Training Provider Application API.
 * Configures Express app with middleware, routes, and error handling.
 * 
 * Server features:
 * - Rate limiting: 60 requests per hour per IP
 * - CORS enabled for cross-origin requests
 * - JSON body parsing (15MB limit)
 * - Request logging with timestamps
 * - Centralized error handling
 * 
 * API Routes:
 * - /api/auth - Authentication endpoints
 * - /api/applications - Applicant endpoints
 * - /api/reviewer - Reviewer endpoints
 * - /api/health - Health check endpoint
 * 
 * Environment variables required:
 * - PORT: Server port (default: 3000)
 * - Firebase environment variables (see utils/firebase.js)
 * - GROQ_API_KEY: Groq API key for AI analysis
 * - MAX_FILE_SIZE_MB: Max upload size (optional, default: 10)
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Initialize Firebase (must be done before routes)
require('./utils/firebase');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Rate limiter: 60 requests per hour per IP address.
 * Prevents abuse and protects against DoS attacks.
 */
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logging middleware

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

app.use('/api/auth', require('./routes/auth'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/reviewer', require('./routes/reviewer'));

/**
 * Test endpoint for error handling.
 * Throws error to verify error middleware works.
 */
app.get('/test-500', (req, res) => {
  throw new Error('Manual test error');
});

/**
 * Health check endpoint.
 * Returns 200 if server is running.
 */
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// ============================================
// ERROR HANDLING
// ============================================

/**
 * 404 handler for undefined routes.
 * Returns JSON error for API routes, different message for others.
 */
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }

  return res.status(404).json({
    error: 'Frontend route not handled by Express in development. Use the React app URL.'
  });
});

/**
 * Global error handler.
 * Catches all errors thrown in routes and middleware.
 */
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  }

  return res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('Training Provider Application API Server');
  console.log('========================================');
  console.log(`API running on: http://localhost:${PORT}`);
  console.log('========================================');
  console.log('');
});