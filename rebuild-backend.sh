#!/bin/bash

echo "🔧 MOONLIT Backend Quick Rebuild"
echo "================================"

# Ensure we have the backend directory
mkdir -p backend/src/{config,routes,middleware,services,utils}

# Create package.json
cat > backend/package.json << 'EOF'
{
  "name": "moonlit-lab-backend",
  "version": "1.1.0",
  "description": "MOONLIT Lab Backend",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.39.0",
    "express-validator": "^7.0.1"
  }
}
EOF

# Create .env template
cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Add your Supabase credentials here:
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
EOF

# Create minimal server.js
cat > backend/src/server.js << 'EOF'
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'MOONLIT Backend Running',
    timestamp: new Date().toISOString()
  });
});

// Basic providers endpoint
app.get('/api/providers', async (req, res) => {
  const supabase = require('./config/supabase');
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('id, first_name, last_name, npi')
      .limit(10);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Test health: http://localhost:${PORT}/health`);
});
EOF

# Create Supabase config
cat > backend/src/config/supabase.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️  Missing Supabase credentials in .env file!');
  console.error('Please add SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
module.exports = supabase;
EOF

echo "✅ Files created! Now:"
echo "1. Edit backend/.env with your Supabase credentials"
echo "2. cd backend && npm install (if needed)"
echo "3. npm start"
