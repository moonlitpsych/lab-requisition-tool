// Lab Orders API Routes
// Smart provider interface for submitting lab orders with auto-population

const express = require('express');
const router = express.Router();
const winston = require('winston');
const intakeqService = require('../services/intakeqService');
const medicaidEligibilityService = require('../services/medicaidEligibilityService');
const LabcorpAgent = require('../services/portalAgents/labcorpAgent');
const labTestCodes = require('../../config/labTestCodes.json');

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

/**
 * GET /api/lab-orders/search-patients
 * Search for patients in IntakeQ
 * Accepts either 'name' (searches both first and last) or 'firstName' + 'lastName'
 */
router.get('/search-patients', async (req, res) => {
    try {
        const { name, firstName, lastName } = req.query;

        // Support both search modes: single 'name' field or separate 'firstName'/'lastName'
        let searchFirstName = firstName;
        let searchLastName = lastName;

        if (name) {
            // Single name search - try as both first and last name
            searchFirstName = name;
            searchLastName = name;
        }

        if (!searchFirstName && !searchLastName) {
            return res.status(400).json({
                error: 'name or firstName is required'
            });
        }

        logger.info(`Searching for patients: ${searchFirstName || ''} ${searchLastName || ''}`);

        const patients = await intakeqService.searchPatients(searchFirstName, searchLastName);

        res.json({
            success: true,
            patients,
            count: patients.length
        });

    } catch (error) {
        logger.error('Patient search failed:', error);
        res.status(500).json({
            error: 'Failed to search patients',
            message: error.message
        });
    }
});

/**
 * POST /api/lab-orders/check-eligibility
 * Check Medicaid eligibility and get demographics
 */
router.post('/check-eligibility', async (req, res) => {
    try {
        const { firstName, lastName, dateOfBirth, medicaidId, intakeqPhone } = req.body;

        if (!firstName || !lastName || !dateOfBirth) {
            return res.status(400).json({
                error: 'firstName, lastName, and dateOfBirth are required'
            });
        }

        logger.info(`Checking Medicaid eligibility for: ${firstName} ${lastName}`);

        const eligibilityData = await medicaidEligibilityService.checkEligibility({
            firstName,
            lastName,
            dateOfBirth,
            medicaidId
        });

        // Phone number fallback logic:
        // 1. Primary: Medicaid (from 271 PER segment)
        // 2. Fallback: IntakeQ (provided from frontend patient search)
        if (!eligibilityData.demographics.phone && intakeqPhone) {
            logger.info(`No phone in Medicaid response, using phone from IntakeQ: ${intakeqPhone}`);
            eligibilityData.demographics.phone = intakeqPhone;
        }

        res.json({
            success: true,
            ...eligibilityData
        });

    } catch (error) {
        logger.error('Eligibility check failed:', error);
        res.status(500).json({
            error: 'Failed to check eligibility',
            message: error.message
        });
    }
});

/**
 * GET /api/lab-orders/available-tests
 * Get list of available lab tests
 */
router.get('/available-tests', (req, res) => {
    try {
        const { category } = req.query;

        let tests = labTestCodes.labcorp.commonTests;

        if (category) {
            tests = tests.filter(test => test.category.toLowerCase() === category.toLowerCase());
        }

        // Group by category for easier UI rendering
        const groupedTests = tests.reduce((acc, test) => {
            if (!acc[test.category]) {
                acc[test.category] = [];
            }
            acc[test.category].push(test);
            return acc;
        }, {});

        res.json({
            success: true,
            tests,
            groupedTests,
            categories: Object.keys(groupedTests)
        });

    } catch (error) {
        logger.error('Failed to fetch available tests:', error);
        res.status(500).json({
            error: 'Failed to fetch available tests',
            message: error.message
        });
    }
});

/**
 * GET /api/lab-orders/available-diagnoses
 * Get list of common psychiatry diagnoses
 */
router.get('/available-diagnoses', (req, res) => {
    try {
        const diagnoses = labTestCodes.icd10.psychiatryDiagnoses;

        res.json({
            success: true,
            diagnoses
        });

    } catch (error) {
        logger.error('Failed to fetch available diagnoses:', error);
        res.status(500).json({
            error: 'Failed to fetch available diagnoses',
            message: error.message
        });
    }
});

/**
 * GET /api/lab-orders/patient-diagnoses/:intakeqId
 * Get patient's existing diagnoses from IntakeQ
 */
router.get('/patient-diagnoses/:intakeqId', async (req, res) => {
    try {
        const { intakeqId } = req.params;

        logger.info(`Fetching diagnoses for IntakeQ patient: ${intakeqId}`);

        const diagnoses = await intakeqService.getPatientDiagnoses(intakeqId);

        res.json({
            success: true,
            diagnoses,
            count: diagnoses.length
        });

    } catch (error) {
        logger.error('Failed to fetch patient diagnoses:', error);
        res.status(500).json({
            error: 'Failed to fetch patient diagnoses',
            message: error.message
        });
    }
});

/**
 * POST /api/lab-orders/submit
 * Submit a lab order (triggers Labcorp automation)
 */
router.post('/submit', async (req, res) => {
    try {
        const {
            providerName,
            patient,
            tests,
            diagnoses,
            useMedicaidData
        } = req.body;

        // Validation
        if (!patient || !patient.firstName || !patient.lastName || !patient.dateOfBirth) {
            return res.status(400).json({
                error: 'Patient information is incomplete',
                required: ['firstName', 'lastName', 'dateOfBirth']
            });
        }

        if (!tests || tests.length === 0) {
            return res.status(400).json({
                error: 'At least one test must be selected'
            });
        }

        if (!diagnoses || diagnoses.length === 0) {
            return res.status(400).json({
                error: 'At least one diagnosis must be linked'
            });
        }

        logger.info(`Submitting lab order for: ${patient.firstName} ${patient.lastName}`);
        logger.info(`Tests: ${tests.map(t => t.name).join(', ')}`);
        logger.info(`Diagnoses: ${diagnoses.join(', ')}`);

        // Map test names to Labcorp codes
        const mappedTests = tests.map(test => {
            const labcorpTest = labTestCodes.labcorp.commonTests.find(
                t => t.code === test.code || t.name === test.name
            );

            if (!labcorpTest) {
                logger.warn(`Test not found in labTestCodes: ${test.name || test.code}`);
            }

            return {
                code: labcorpTest?.code || test.code,
                name: labcorpTest?.name || test.name,
                category: labcorpTest?.category || 'Unknown'
            };
        });

        // Prepare order data for automation
        const orderData = {
            id: `order_${Date.now()}`, // Generate unique ID
            providerName: providerName || 'MOONLIT Provider',
            patient: {
                ...patient,
                useMedicaidData: useMedicaidData !== false // Default to true
            },
            tests: mappedTests,
            diagnosisCodes: diagnoses,
            retry_count: 0,
            createdAt: new Date().toISOString()
        };

        // Get Socket.io instance from app
        const io = req.app.get('io');

        // Initialize Labcorp agent
        const labcorpAgent = new LabcorpAgent({ io });

        // Start automation in background
        // Return immediately with order ID, let automation run async
        res.json({
            success: true,
            message: 'Lab order submitted - automation in progress',
            orderId: orderData.id,
            status: 'processing'
        });

        // Process order asynchronously
        labcorpAgent.processOrder(orderData)
            .then(result => {
                logger.info(`Order ${orderData.id} completed successfully:`, result);
            })
            .catch(error => {
                logger.error(`Order ${orderData.id} failed:`, error.message);
                // Email notification already sent by labcorpAgent
            });

    } catch (error) {
        logger.error('Failed to submit lab order:', error);
        res.status(500).json({
            error: 'Failed to submit lab order',
            message: error.message
        });
    }
});

/**
 * GET /api/lab-orders/status/:orderId
 * Get status of a lab order automation
 */
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // TODO: Query database for order status
        // For now, return a placeholder

        res.json({
            success: true,
            orderId,
            status: 'processing',
            message: 'Order automation in progress - check Socket.io for real-time updates'
        });

    } catch (error) {
        logger.error('Failed to get order status:', error);
        res.status(500).json({
            error: 'Failed to get order status',
            message: error.message
        });
    }
});

module.exports = router;
