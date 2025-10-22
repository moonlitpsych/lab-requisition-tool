// Results Management Routes
// Handles lab results retrieval and management

const express = require('express');
const router = express.Router();
const { getSupabase, savePortalResult } = require('../services/supabase');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

/**
 * GET /api/results
 * Get all results with filters
 */
router.get('/', async (req, res) => {
    try {
        const { patientId, portal, dateFrom, dateTo, reviewed } = req.query;

        let query = getSupabase()
            .from('portal_results')
            .select(`
                *,
                patient:patients(first_name, last_name),
                portal_order:portal_orders(confirmation_number)
            `);

        // Apply filters
        if (patientId) query = query.eq('patient_id', patientId);
        if (portal) query = query.eq('portal', portal);
        if (dateFrom) query = query.gte('result_date', dateFrom);
        if (dateTo) query = query.lte('result_date', dateTo);
        if (reviewed !== undefined) {
            query = reviewed === 'true'
                ? query.not('reviewed_by', 'is', null)
                : query.is('reviewed_by', null);
        }

        const { data: results, error } = await query
            .order('result_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            results: results || [],
            count: results?.length || 0
        });
    } catch (error) {
        logger.error('Failed to get results:', error);
        res.status(500).json({ error: 'Failed to get results' });
    }
});

/**
 * GET /api/results/recent
 * Get recent results (last 30 days) - uses view
 */
router.get('/recent', async (req, res) => {
    try {
        const { data: results, error } = await getSupabase()
            .from('recent_results')
            .select('*')
            .limit(100);

        if (error) throw error;

        res.json({
            results: results || [],
            count: results?.length || 0
        });
    } catch (error) {
        logger.error('Failed to get recent results:', error);
        res.status(500).json({ error: 'Failed to get recent results' });
    }
});

/**
 * GET /api/results/:id
 * Get single result
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: result, error } = await getSupabase()
            .from('portal_results')
            .select(`
                *,
                patient:patients(*),
                portal_order:portal_orders(*),
                reviewed_by_provider:providers!portal_results_reviewed_by_fkey(name)
            `)
            .eq('id', req.params.id)
            .single();

        if (error || !result) {
            return res.status(404).json({ error: 'Result not found' });
        }

        res.json(result);
    } catch (error) {
        logger.error('Failed to get result:', error);
        res.status(500).json({ error: 'Failed to get result' });
    }
});

/**
 * POST /api/results/:id/review
 * Mark result as reviewed
 */
router.post('/:id/review', async (req, res) => {
    try {
        const { providerId } = req.body;

        if (!providerId) {
            return res.status(400).json({ error: 'Provider ID required' });
        }

        const { data: result, error } = await getSupabase()
            .from('portal_results')
            .update({
                reviewed_by: providerId,
                reviewed_at: new Date().toISOString(),
                processed: true
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        logger.error('Failed to mark result as reviewed:', error);
        res.status(500).json({ error: 'Failed to mark as reviewed' });
    }
});

/**
 * GET /api/results/abnormal
 * Get all abnormal/critical results that need review
 */
router.get('/abnormal', async (req, res) => {
    try {
        const { data: results, error } = await getSupabase()
            .from('portal_results')
            .select(`
                *,
                patient:patients(first_name, last_name, phone)
            `)
            .in('result_status', ['abnormal', 'critical'])
            .is('reviewed_by', null)
            .order('result_date', { ascending: false });

        if (error) throw error;

        res.json({
            results: results || [],
            count: results?.length || 0,
            criticalCount: results?.filter(r => r.result_status === 'critical').length || 0
        });
    } catch (error) {
        logger.error('Failed to get abnormal results:', error);
        res.status(500).json({ error: 'Failed to get abnormal results' });
    }
});

/**
 * POST /api/results/import
 * Import results (for manual entry or bulk import)
 */
router.post('/import', async (req, res) => {
    try {
        const results = Array.isArray(req.body) ? req.body : [req.body];
        const imported = [];
        const failed = [];

        for (const result of results) {
            try {
                const savedResult = await savePortalResult(result);
                imported.push(savedResult);
            } catch (error) {
                failed.push({
                    data: result,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            imported: imported.length,
            failed: failed.length,
            failures: failed
        });
    } catch (error) {
        logger.error('Failed to import results:', error);
        res.status(500).json({ error: 'Failed to import results' });
    }
});

/**
 * GET /api/results/stats
 * Get results statistics
 */
router.get('/stats', async (req, res) => {
    try {
        // Get total counts by status
        const { data: statusCounts, error: statusError } = await getSupabase()
            .from('portal_results')
            .select('result_status')
            .not('result_status', 'is', null);

        if (statusError) throw statusError;

        const stats = {
            total: statusCounts.length,
            normal: statusCounts.filter(r => r.result_status === 'normal').length,
            abnormal: statusCounts.filter(r => r.result_status === 'abnormal').length,
            critical: statusCounts.filter(r => r.result_status === 'critical').length
        };

        // Get reviewed vs unreviewed counts
        const { data: reviewCounts, error: reviewError } = await getSupabase()
            .from('portal_results')
            .select('reviewed_by');

        if (reviewError) throw reviewError;

        stats.reviewed = reviewCounts.filter(r => r.reviewed_by !== null).length;
        stats.unreviewed = reviewCounts.filter(r => r.reviewed_by === null).length;

        // Get counts by portal
        const { data: portalCounts, error: portalError } = await getSupabase()
            .from('portal_results')
            .select('portal');

        if (portalError) throw portalError;

        stats.byPortal = {
            labcorp: portalCounts.filter(r => r.portal === 'labcorp').length,
            quest: portalCounts.filter(r => r.portal === 'quest').length
        };

        res.json(stats);
    } catch (error) {
        logger.error('Failed to get results stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

module.exports = router;