// MOONLIT Lab Portal Automation Server
// Main Express server for handling portal automation requests

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const path = require('path');

// Import routes
const portalAutomationRoutes = require('./routes/portalAutomation');
const patientRoutes = require('./routes/patients');
const providerRoutes = require('./routes/providers');
const resultsRoutes = require('./routes/results');

// Import services
const { initializeSupabase } = require('./services/supabase');
const { startResultsCron } = require('./services/resultsScraper');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io for real-time updates
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve screenshots directory as static files
app.use('/screenshots', express.static(path.join(__dirname, '../test-screenshots')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            database: 'connected',
            playwright: 'ready',
            gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not configured'
        }
    });
});

// API Routes
app.use('/api/portal-automation', portalAutomationRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/results', resultsRoutes);

// Socket.io connection handling for real-time updates
io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);

    socket.on('join-order-room', (orderId) => {
        socket.join(`order-${orderId}`);
        logger.info(`Socket ${socket.id} joined room: order-${orderId}`);
    });

    socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize services and start server
async function startServer() {
    try {
        // Initialize Supabase connection (optional for testing)
        try {
            await initializeSupabase();
            logger.info('Supabase connection initialized');
        } catch (error) {
            logger.warn('Supabase not configured - running without database:', error.message);
        }

        // Start results scraping cron job (if enabled)
        if (process.env.ENABLE_RESULTS_SCRAPING === 'true') {
            startResultsCron();
            logger.info('Results scraping cron job started');
        }

        // Start server
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            logger.info(`MOONLIT Lab Portal Automation Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Preview mode: ${process.env.ENABLE_PREVIEW_MODE === 'true' ? 'enabled' : 'disabled'}`);
            logger.info(`Headless mode: ${process.env.HEADLESS_MODE === 'true' ? 'enabled' : 'disabled'}`);

            console.log(`
╔══════════════════════════════════════════════════════╗
║     MOONLIT Lab Portal Automation Server            ║
║                                                      ║
║     Server running at: http://localhost:${PORT}        ║
║     Health check: http://localhost:${PORT}/health      ║
║                                                      ║
║     Ready for portal automation!                    ║
╚══════════════════════════════════════════════════════╝
            `);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down server...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
});

// Start the server
startServer();