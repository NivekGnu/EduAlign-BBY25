const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Initialize Firebase
require('./utils/firebase');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// request logging
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

app.get('/test-500', (req, res) => {
  throw new Error('Manual test error');
});

// Optional health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }

  return res.status(404).json({
    error: 'Frontend route not handled by Express in development. Use the React app URL.'
  });
});

// error handler
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