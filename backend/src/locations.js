const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { lab_company } = req.query;
    
    let query = supabase
      .from('lab_locations')
      .select('*')
      .eq('is_active', true);
    
    if (lab_company) {
      query = query.eq('lab_company', lab_company);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
