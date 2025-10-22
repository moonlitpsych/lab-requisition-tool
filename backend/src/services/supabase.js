// Supabase Database Service
// Handles all database interactions for the lab portal automation

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

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

let supabase = null;

/**
 * Initialize Supabase client
 */
async function initializeSupabase() {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Missing Supabase configuration. Please check your .env file.');
        }

        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY,
            {
                auth: {
                    persistSession: false
                }
            }
        );

        // Test connection
        const { data, error } = await supabase
            .from('providers')
            .select('id')
            .limit(1);

        if (error) {
            throw error;
        }

        logger.info('Supabase connection established successfully');
        return supabase;
    } catch (error) {
        logger.error('Failed to initialize Supabase:', error);
        throw error;
    }
}

/**
 * Get Supabase client instance
 */
function getSupabase() {
    if (!supabase) {
        throw new Error('Supabase not initialized. Call initializeSupabase first.');
    }
    return supabase;
}

/**
 * Create or update a patient record
 */
async function upsertPatient(patientData) {
    try {
        const { data, error } = await getSupabase()
            .from('patients')
            .upsert({
                first_name: patientData.firstName,
                last_name: patientData.lastName,
                date_of_birth: patientData.dateOfBirth,
                medicaid_id: patientData.medicaidId,
                phone: patientData.phone,
                email: patientData.email,
                address: patientData.address
            }, {
                onConflict: 'first_name,last_name,date_of_birth',
                returning: true
            })
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to upsert patient:', error);
        throw error;
    }
}

/**
 * Create a new portal order
 */
async function createPortalOrder(orderData) {
    try {
        const { data, error } = await getSupabase()
            .from('portal_orders')
            .insert({
                patient_id: orderData.patientId,
                provider_id: orderData.providerId,
                portal: orderData.portal,
                status: 'pending',
                tests_ordered: orderData.testsOrdered,
                diagnosis_codes: orderData.diagnosisCodes,
                special_instructions: orderData.specialInstructions
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to create portal order:', error);
        throw error;
    }
}

/**
 * Update portal order status
 */
async function updateOrderStatus(orderId, status, additionalData = {}) {
    try {
        const updateData = {
            status,
            ...additionalData
        };

        // Add timestamp for specific status changes
        if (status === 'submitted') {
            updateData.submitted_at = new Date().toISOString();
        } else if (status === 'confirmed') {
            updateData.confirmed_at = new Date().toISOString();
        }

        const { data, error } = await getSupabase()
            .from('portal_orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to update order status:', error);
        throw error;
    }
}

/**
 * Save automation log entry
 */
async function logAutomation(logData) {
    try {
        const { data, error } = await getSupabase()
            .from('automation_logs')
            .insert({
                portal_order_id: logData.portalOrderId,
                action: logData.action,
                status: logData.status,
                details: logData.details,
                screenshot_url: logData.screenshotUrl,
                error_message: logData.errorMessage,
                duration_ms: logData.durationMs
            });

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to log automation:', error);
        // Don't throw - logging failures shouldn't break the automation
    }
}

/**
 * Create notification for alerts
 */
async function createNotification(notificationData) {
    try {
        const { data, error } = await getSupabase()
            .from('notifications')
            .insert({
                portal_order_id: notificationData.portalOrderId,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message
            });

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to create notification:', error);
        throw error;
    }
}

/**
 * Get active portal session
 */
async function getActiveSession(portal) {
    try {
        const { data, error } = await getSupabase()
            .from('portal_sessions')
            .select('*')
            .eq('portal', portal)
            .eq('is_valid', true)
            .gt('valid_until', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found error is ok
            throw error;
        }
        return data;
    } catch (error) {
        logger.error('Failed to get active session:', error);
        return null;
    }
}

/**
 * Save portal session
 */
async function savePortalSession(sessionData) {
    try {
        // Invalidate old sessions
        await getSupabase()
            .from('portal_sessions')
            .update({ is_valid: false })
            .eq('portal', sessionData.portal)
            .eq('is_valid', true);

        // Create new session
        const { data, error } = await getSupabase()
            .from('portal_sessions')
            .insert({
                portal: sessionData.portal,
                session_data: sessionData.sessionData,
                valid_until: sessionData.validUntil,
                is_valid: true
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to save portal session:', error);
        throw error;
    }
}

/**
 * Get provider by NPI
 */
async function getProviderByNPI(npi) {
    try {
        const { data, error } = await getSupabase()
            .from('providers')
            .select('*')
            .eq('npi', npi)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        return data;
    } catch (error) {
        logger.error('Failed to get provider:', error);
        throw error;
    }
}

/**
 * Get lab tests by portal
 */
async function getLabTestsByPortal(portal) {
    try {
        const { data, error } = await getSupabase()
            .from('lab_tests')
            .select('*')
            .eq('portal', portal)
            .eq('is_active', true)
            .order('test_name');

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error('Failed to get lab tests:', error);
        throw error;
    }
}

/**
 * Save portal result
 */
async function savePortalResult(resultData) {
    try {
        const { data, error } = await getSupabase()
            .from('portal_results')
            .insert({
                portal_order_id: resultData.portalOrderId,
                patient_id: resultData.patientId,
                portal: resultData.portal,
                test_name: resultData.testName,
                test_code: resultData.testCode,
                result_value: resultData.resultValue,
                result_unit: resultData.resultUnit,
                reference_range: resultData.referenceRange,
                result_status: resultData.resultStatus,
                result_date: resultData.resultDate,
                pdf_url: resultData.pdfUrl,
                raw_data: resultData.rawData
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Failed to save portal result:', error);
        throw error;
    }
}

/**
 * Get pending orders for automation
 */
async function getPendingOrders() {
    try {
        const { data, error } = await getSupabase()
            .from('portal_orders')
            .select(`
                *,
                patient:patients(*),
                provider:providers(*)
            `)
            .in('status', ['pending', 'preview'])
            .lt('retry_count', 3)
            .order('created_at');

        if (error) throw error;
        return data || [];
    } catch (error) {
        logger.error('Failed to get pending orders:', error);
        throw error;
    }
}

module.exports = {
    initializeSupabase,
    getSupabase,
    upsertPatient,
    createPortalOrder,
    updateOrderStatus,
    logAutomation,
    createNotification,
    getActiveSession,
    savePortalSession,
    getProviderByNPI,
    getLabTestsByPortal,
    savePortalResult,
    getPendingOrders
};