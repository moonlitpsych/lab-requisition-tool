const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payers')
      .select('id, name, payer_type')
      .order('name')
      .limit(20);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/medicaid', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('payers')
      .select('id, name, payer_type')
      .or('name.ilike.%medicaid%,payer_type.ilike.%medicaid%')
      .order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
