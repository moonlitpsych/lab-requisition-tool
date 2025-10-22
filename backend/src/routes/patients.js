// Patient Management Routes
// Handles patient CRUD operations

const express = require('express');
const router = express.Router();
const { getSupabase, upsertPatient } = require('../services/supabase');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

/**
 * GET /api/patients
 * Get all patients
 */
router.get('/', async (req, res) => {
    try {
        const { data: patients, error } = await getSupabase()
            .from('patients')
            .select('*')
            .order('last_name', { ascending: true });

        if (error) throw error;

        res.json({
            patients: patients || [],
            count: patients?.length || 0
        });
    } catch (error) {
        logger.error('Failed to get patients:', error);
        res.status(500).json({ error: 'Failed to get patients' });
    }
});

/**
 * GET /api/patients/:id
 * Get single patient
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: patient, error } = await getSupabase()
            .from('patients')
            .select(`
                *,
                portal_orders(id, portal, status, created_at),
                portal_results(test_name, result_value, result_date)
            `)
            .eq('id', req.params.id)
            .single();

        if (error || !patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(patient);
    } catch (error) {
        logger.error('Failed to get patient:', error);
        res.status(500).json({ error: 'Failed to get patient' });
    }
});

/**
 * POST /api/patients
 * Create or update patient
 */
router.post('/', async (req, res) => {
    try {
        const patient = await upsertPatient(req.body);
        res.json({
            success: true,
            patient: patient
        });
    } catch (error) {
        logger.error('Failed to create patient:', error);
        res.status(500).json({ error: 'Failed to create patient' });
    }
});

/**
 * GET /api/patients/search
 * Search patients by name
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ patients: [] });
        }

        const { data: patients, error } = await getSupabase()
            .from('patients')
            .select('id, first_name, last_name, date_of_birth, medicaid_id')
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .limit(10);

        if (error) throw error;

        res.json({ patients: patients || [] });
    } catch (error) {
        logger.error('Patient search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;