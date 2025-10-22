const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('lab_order_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/apply', async (req, res) => {
  try {
    const { lab_company } = req.body;
    const { id } = req.params;
    
    const { data: template, error: templateError } = await supabase
      .from('lab_order_templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (templateError) throw templateError;
    
    // Get tests for this template
    const { data: templateTests, error: testsError } = await supabase
      .from('lab_order_template_tests')
      .select('*, lab_test:lab_tests(*)')
      .eq('template_id', id);
    
    if (testsError) throw testsError;
    
    const tests = templateTests.map(t => ({
      lab_test_id: t.lab_test.id,
      name: t.lab_test.name,
      code: lab_company === 'labcorp' ? t.lab_test.labcorp_code : t.lab_test.quest_code
    })).filter(t => t.code);
    
    res.json({
      template_name: template.name,
      tests,
      suggested_diagnosis: {
        code: template.suggested_dx_code,
        description: template.suggested_dx_desc
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
