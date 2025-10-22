const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }
    
    const { data, error } = await supabase
      .from('icd10_codes')
      .select('*')
      .or(`code.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(10)
      .order('code');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/psychiatric', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('icd10_codes')
      .select('*')
      .eq('is_psychiatric', true)
      .order('category')
      .order('code');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
