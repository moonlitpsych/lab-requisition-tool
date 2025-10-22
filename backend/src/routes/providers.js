// Provider Management Routes
// Handles provider CRUD operations

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../services/supabase');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

/**
 * GET /api/providers
 * Get all providers
 */
router.get('/', async (req, res) => {
    try {
        const { data: providers, error } = await getSupabase()
            .from('providers')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        res.json({
            providers: providers || [],
            count: providers?.length || 0
        });
    } catch (error) {
        logger.error('Failed to get providers:', error);
        res.status(500).json({ error: 'Failed to get providers' });
    }
});

/**
 * GET /api/providers/:id
 * Get single provider
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: provider, error } = await getSupabase()
            .from('providers')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        res.json(provider);
    } catch (error) {
        logger.error('Failed to get provider:', error);
        res.status(500).json({ error: 'Failed to get provider' });
    }
});

/**
 * POST /api/providers
 * Create provider
 */
router.post('/', async (req, res) => {
    try {
        const { data: provider, error } = await getSupabase()
            .from('providers')
            .insert({
                name: req.body.name,
                npi: req.body.npi,
                clinic_name: req.body.clinicName,
                clinic_address: req.body.clinicAddress,
                phone: req.body.phone,
                fax: req.body.fax
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'Provider with this NPI already exists' });
            }
            throw error;
        }

        res.json({
            success: true,
            provider: provider
        });
    } catch (error) {
        logger.error('Failed to create provider:', error);
        res.status(500).json({ error: 'Failed to create provider' });
    }
});

/**
 * PUT /api/providers/:id
 * Update provider
 */
router.put('/:id', async (req, res) => {
    try {
        const { data: provider, error } = await getSupabase()
            .from('providers')
            .update({
                name: req.body.name,
                clinic_name: req.body.clinicName,
                clinic_address: req.body.clinicAddress,
                phone: req.body.phone,
                fax: req.body.fax,
                is_active: req.body.isActive
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            provider: provider
        });
    } catch (error) {
        logger.error('Failed to update provider:', error);
        res.status(500).json({ error: 'Failed to update provider' });
    }
});

module.exports = router;