const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import ALL routes
const providersRoute = require('./routes/providers');
const requisitionsRoute = require('./routes/requisitions');
const labTestsRoute = require('./routes/labTests');
const templatesRoute = require('./routes/templates');
const icd10Route = require('./routes/icd10');
const payersRoute = require('./routes/payers');
const locationsRoute = require('./routes/locations');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'MOONLIT Backend - All Routes Active',
    timestamp: new Date().toISOString(),
    routes: {
      providers: '/api/providers',
      requisitions: '/api/requisitions',
      labTests: '/api/lab-tests',
      templates: '/api/templates',
      icd10: '/api/icd10/psychiatric',
      payers: '/api/payers',
      locations: '/api/locations'
    }
  });
});

// Register ALL routes
app.use('/api/providers', providersRoute);
app.use('/api/requisitions', requisitionsRoute);
app.use('/api/lab-tests', labTestsRoute);
app.use('/api/templates', templatesRoute);
app.use('/api/icd10', icd10Route);
app.use('/api/payers', payersRoute);
app.use('/api/locations', locationsRoute);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    message: 'This endpoint does not exist'
  });
});

app.listen(PORT, () => {
  console.log('🚀 MOONLIT Lab Backend - COMPLETE');
  console.log(`✅ Server: http://localhost:${PORT}`);
  console.log(`📊 All routes loaded successfully`);
});

module.exports = app;
