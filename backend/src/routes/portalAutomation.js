// Portal Automation API Routes
// Handles all automation-related API endpoints

const express = require('express');
const router = express.Router();
const winston = require('winston');
const LabcorpAgent = require('../services/portalAgents/labcorpAgent');
const QuestAgent = require('../services/portalAgents/questAgent');
const { getLLMHelper } = require('../services/portalAgents/llmHelper');
const {
    upsertPatient,
    createPortalOrder,
    updateOrderStatus,
    getSupabase,
    createNotification,
    logAutomation
} = require('../services/supabase');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Active automation sessions (for preview mode)
const activeSessions = new Map();

/**
 * POST /api/portal-automation/order
 * Submit a new order to a portal
 */
router.post('/order', async (req, res) => {
    try {
        const {
            portal,
            patient,
            provider,
            tests,
            diagnosisCodes,
            specialInstructions
        } = req.body;

        // Validate required fields
        if (!portal || !patient || !tests || tests.length === 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['portal', 'patient', 'tests']
            });
        }

        // Validate portal
        if (!['labcorp', 'quest'].includes(portal)) {
            return res.status(400).json({
                error: 'Invalid portal. Must be "labcorp" or "quest"'
            });
        }

        logger.info(`Processing ${portal} order for ${patient.firstName} ${patient.lastName}`);

        // Upsert patient record
        const patientRecord = await upsertPatient(patient);

        // Get provider (default to first provider if not specified)
        let providerId = provider?.id;
        if (!providerId) {
            const { data: providers } = await getSupabase()
                .from('providers')
                .select('id')
                .limit(1);

            if (providers && providers.length > 0) {
                providerId = providers[0].id;
            } else {
                throw new Error('No provider found in database');
            }
        }

        // Create portal order record
        const order = await createPortalOrder({
            patientId: patientRecord.id,
            providerId: providerId,
            portal: portal,
            testsOrdered: tests,
            diagnosisCodes: diagnosisCodes || [],
            specialInstructions: specialInstructions
        });

        // Get Socket.io instance
        const io = req.app.get('io');

        // Initialize appropriate agent
        let agent;
        if (portal === 'labcorp') {
            agent = new LabcorpAgent({ io });
        } else {
            agent = new QuestAgent({ io });
        }

        // Store session for preview confirmation
        activeSessions.set(order.id, agent);

        // Process order
        const result = await agent.processOrder({
            id: order.id,
            patient: patient,
            tests: tests,
            diagnosisCodes: diagnosisCodes,
            retry_count: 0
        });

        // Clean up session if order was auto-submitted
        if (result.status !== 'preview') {
            activeSessions.delete(order.id);
        }

        res.json({
            success: true,
            orderId: order.id,
            ...result
        });

    } catch (error) {
        logger.error('Order submission failed:', error);
        res.status(500).json({
            error: 'Failed to process order',
            message: error.message
        });
    }
});

/**
 * GET /api/portal-automation/preview/:orderId
 * Get preview screenshot for an order
 */
router.get('/preview/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Get order from database
        const { data: order, error } = await getSupabase()
            .from('portal_orders')
            .select('*, patient:patients(*), provider:providers(*)')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'preview') {
            return res.status(400).json({
                error: 'Order is not in preview status',
                currentStatus: order.status
            });
        }

        res.json({
            orderId: order.id,
            portal: order.portal,
            status: order.status,
            previewUrl: order.preview_screenshot_url,
            patient: `${order.patient.first_name} ${order.patient.last_name}`,
            testsOrdered: order.tests_ordered,
            diagnosisCodes: order.diagnosis_codes
        });

    } catch (error) {
        logger.error('Failed to get preview:', error);
        res.status(500).json({
            error: 'Failed to get preview',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/confirm/:orderId
 * Confirm and submit a previewed order
 */
router.post('/confirm/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Check if session exists
        const agent = activeSessions.get(orderId);
        if (!agent) {
            return res.status(400).json({
                error: 'Session expired',
                message: 'Order session has expired. Please restart the order.'
            });
        }

        logger.info(`Confirming order ${orderId}`);

        // Update status to confirmed
        await updateOrderStatus(orderId, 'confirmed');

        // Submit the order
        const result = await agent.confirmOrder(orderId);

        // Clean up session
        activeSessions.delete(orderId);

        res.json({
            success: true,
            orderId: orderId,
            ...result
        });

    } catch (error) {
        logger.error('Order confirmation failed:', error);

        // Clean up session on error
        activeSessions.delete(req.params.orderId);

        res.status(500).json({
            error: 'Failed to confirm order',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/cancel/:orderId
 * Cancel a previewed order
 */
router.post('/cancel/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { generatePdf } = req.body;

        // Clean up session if exists
        const agent = activeSessions.get(orderId);
        if (agent) {
            await agent.cleanup();
            activeSessions.delete(orderId);
        }

        // Update order status
        await updateOrderStatus(orderId, 'cancelled');

        // Create notification
        await createNotification({
            portalOrderId: orderId,
            type: 'info',
            title: 'Order Cancelled',
            message: 'Order was cancelled by user'
        });

        // Generate PDF if requested
        let pdfUrl = null;
        if (generatePdf) {
            // TODO: Integrate with existing PDF generator
            logger.info('PDF generation requested for cancelled order');
        }

        res.json({
            success: true,
            orderId: orderId,
            status: 'cancelled',
            pdfUrl: pdfUrl
        });

    } catch (error) {
        logger.error('Failed to cancel order:', error);
        res.status(500).json({
            error: 'Failed to cancel order',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/retry/:orderId
 * Retry a failed order
 */
router.post('/retry/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Get order details
        const { data: order, error } = await getSupabase()
            .from('portal_orders')
            .select('*, patient:patients(*), provider:providers(*)')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status !== 'failed') {
            return res.status(400).json({
                error: 'Can only retry failed orders',
                currentStatus: order.status
            });
        }

        logger.info(`Retrying order ${orderId} (attempt ${order.retry_count + 1})`);

        // Get Socket.io instance
        const io = req.app.get('io');

        // Initialize appropriate agent
        let agent;
        if (order.portal === 'labcorp') {
            agent = new LabcorpAgent({ io });
        } else {
            agent = new QuestAgent({ io });
        }

        // Process order with incremented retry count
        const result = await agent.processOrder({
            id: order.id,
            patient: order.patient,
            tests: order.tests_ordered,
            diagnosisCodes: order.diagnosis_codes,
            retry_count: order.retry_count
        });

        res.json({
            success: true,
            orderId: order.id,
            ...result
        });

    } catch (error) {
        logger.error('Order retry failed:', error);
        res.status(500).json({
            error: 'Failed to retry order',
            message: error.message
        });
    }
});

/**
 * GET /api/portal-automation/status/:orderId
 * Get current status of an order
 */
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const { data: order, error } = await getSupabase()
            .from('portal_orders')
            .select(`
                *,
                patient:patients(first_name, last_name),
                provider:providers(name),
                automation_logs(action, status, created_at)
            `)
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            orderId: order.id,
            portal: order.portal,
            status: order.status,
            patient: `${order.patient.first_name} ${order.patient.last_name}`,
            provider: order.provider.name,
            confirmationNumber: order.confirmation_number,
            testsOrdered: order.tests_ordered,
            createdAt: order.created_at,
            submittedAt: order.submitted_at,
            logs: order.automation_logs
        });

    } catch (error) {
        logger.error('Failed to get order status:', error);
        res.status(500).json({
            error: 'Failed to get order status',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/test-connection/:portal
 * Test portal connection and credentials
 */
router.post('/test-connection/:portal', async (req, res) => {
    try {
        const { portal } = req.params;

        if (!['labcorp', 'quest'].includes(portal)) {
            return res.status(400).json({
                error: 'Invalid portal. Must be "labcorp" or "quest"'
            });
        }

        logger.info(`Testing ${portal} connection...`);

        // Initialize agent
        let agent;
        if (portal === 'labcorp') {
            agent = new LabcorpAgent();
        } else {
            agent = new QuestAgent();
        }

        // Try to initialize and login
        await agent.initialize();
        const loginSuccess = await agent.login();

        if (loginSuccess) {
            await agent.cleanup();

            res.json({
                success: true,
                portal: portal,
                message: `Successfully connected to ${portal}`
            });
        } else {
            throw new Error('Login failed');
        }

    } catch (error) {
        logger.error('Connection test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Connection test failed',
            message: error.message
        });
    }
});

/**
 * GET /api/portal-automation/active-orders
 * Get all active orders (pending, preview, confirmed)
 */
router.get('/active-orders', async (req, res) => {
    try {
        const { data: orders, error } = await getSupabase()
            .from('active_orders') // This is a view we created
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            orders: orders || [],
            count: orders?.length || 0
        });

    } catch (error) {
        logger.error('Failed to get active orders:', error);
        res.status(500).json({
            error: 'Failed to get active orders',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/generate-pdf/:orderId
 * Generate PDF fallback for an order
 */
router.post('/generate-pdf/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Get order details
        const { data: order, error } = await getSupabase()
            .from('portal_orders')
            .select('*, patient:patients(*), provider:providers(*)')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // TODO: Integrate with existing PDF generator
        // For now, return a placeholder response

        logger.info(`Generating PDF for order ${orderId}`);

        // Update order with PDF URL
        await updateOrderStatus(orderId, order.status, {
            pdf_backup_url: '/pdfs/placeholder.pdf'
        });

        res.json({
            success: true,
            orderId: orderId,
            pdfUrl: '/pdfs/placeholder.pdf',
            message: 'PDF generation will be integrated with existing generator'
        });

    } catch (error) {
        logger.error('PDF generation failed:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

/**
 * POST /api/portal-automation/diagnose-error
 * Use LLM to diagnose automation errors
 */
router.post('/diagnose-error', async (req, res) => {
    try {
        const { errorMessage, screenshotPath, currentUrl } = req.body;

        const llmHelper = getLLMHelper();
        const diagnosis = await llmHelper.diagnoseError(
            errorMessage,
            screenshotPath,
            currentUrl
        );

        res.json({
            success: true,
            diagnosis: diagnosis
        });

    } catch (error) {
        logger.error('Error diagnosis failed:', error);
        res.status(500).json({
            error: 'Failed to diagnose error',
            message: error.message
        });
    }
});

// Test portal connection
router.post('/test-connection', async (req, res) => {
    try {
        const { portal } = req.body;

        if (!portal || !['labcorp', 'quest'].includes(portal)) {
            return res.status(400).json({
                error: 'Invalid portal. Must be "labcorp" or "quest"'
            });
        }

        logger.info(`Testing connection to ${portal} portal...`);

        // Get the appropriate agent
        const AgentClass = portal === 'labcorp' ? LabcorpAgent : QuestAgent;
        const agent = new AgentClass();

        // Initialize browser
        await agent.initialize();

        // Try to login
        const loginResult = await agent.login();

        // Close browser
        await agent.cleanup();

        res.json({
            success: loginResult,
            portal: portal,
            message: loginResult ?
                `Successfully connected to ${portal} portal` :
                `Failed to connect to ${portal} portal`
        });

    } catch (error) {
        logger.error(`Connection test failed for ${req.body.portal}:`, error);
        res.status(500).json({
            success: false,
            portal: req.body.portal,
            error: error.message,
            details: error.stack
        });
    }
});

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [orderId, agent] of activeSessions.entries()) {
        // Clean up sessions older than 15 minutes
        if (agent.createdAt && now - agent.createdAt > 15 * 60 * 1000) {
            logger.info(`Cleaning up expired session for order ${orderId}`);
            agent.cleanup();
            activeSessions.delete(orderId);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = router;