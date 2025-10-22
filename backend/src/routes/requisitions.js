const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lab_requisitions')
      .insert([req.body])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lab_requisitions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
