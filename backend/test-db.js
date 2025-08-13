require('dotenv').config();
const supabase = require('./src/config/supabase');

async function testDatabase() {
  console.log('Testing database connections...\n');
  
  // Test lab_tests
  const { data: tests, error: testError } = await supabase
    .from('lab_tests')
    .select('*')
    .limit(5);
  
  console.log('Lab Tests:', tests ? `Found ${tests.length} tests` : 'ERROR:', testError);
  if (tests && tests.length > 0) {
    console.log('First test:', tests[0].name);
  }
  
  // Test templates
  const { data: templates, error: templateError } = await supabase
    .from('lab_order_templates')
    .select('*')
    .limit(5);
  
  console.log('\nTemplates:', templates ? `Found ${templates.length} templates` : 'ERROR:', templateError);
  
  // Test ICD-10
  const { data: codes, error: codeError } = await supabase
    .from('icd10_codes')
    .select('*')
    .limit(5);
  
  console.log('\nICD-10 Codes:', codes ? `Found ${codes.length} codes` : 'ERROR:', codeError);
  
  process.exit(0);
}

testDatabase();
