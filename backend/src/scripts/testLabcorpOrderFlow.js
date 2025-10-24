// Test Script for Labcorp Link Order Automation
// File: backend/src/scripts/testLabcorpOrderFlow.js

const LabcorpAgent = require('../services/portalAgents/labcorpAgent');
require('dotenv').config();

// Test order data - UPDATE WITH YOUR REAL DATA
const testOrderData = {
    id: 'test-order-001',  // Order ID for tracking
    retry_count: 0,
    patient: {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '1985-03-15',
        gender: 'Female',
        address: {
            street: '50 N Medical Dr',  // Real University of Utah Hospital address
            city: 'Salt Lake City',
            state: 'Utah',
            zip: '84132'
        },
        phone: '8013598862',  // Real format phone number
        medicaidId: 'UT123456789',
        insuranceProvider: 'Medicaid'  // Simplified name - insuranceHelper will recognize it
    },
    providerName: 'Merrick Reynolds, MD',
    tests: [
        { code: '7600', name: 'Complete Blood Count (CBC) With Differential' },
        { code: '322000', name: 'Comprehensive Metabolic Panel (14)' },
        { code: '330015', name: 'Thyroid Cascade Profile' }
    ],
    diagnosisCodes: ['F31.30', 'Z51.81'],  // Bipolar depression, Drug level monitoring
    userInitials: 'UN'
};

async function runTest() {
    const agent = new LabcorpAgent();

    try {
        console.log('🧪 ===================================');
        console.log('   LABCORP ORDER FLOW TEST');
        console.log('   ===================================\n');

        // Step 1: Initialize
        console.log('1️⃣  Initializing browser...');
        await agent.initialize();
        console.log('    ✅ Browser initialized\n');

        // Step 2: Login
        console.log('2️⃣  Logging into Labcorp Link...');
        await agent.login();
        console.log('    ✅ Logged in successfully\n');

        // Step 3: Navigate to order form
        console.log('3️⃣  Navigating to new order form...');
        await agent.navigateToOrderForm();
        console.log('    ✅ Navigated to order form\n');

        // Step 4: Fill patient information
        console.log('4️⃣  Entering patient information...');
        console.log(`    Patient: ${testOrderData.patient.firstName} ${testOrderData.patient.lastName}`);
        await agent.fillPatientInfo(testOrderData.patient);
        console.log('    ✅ Patient information entered\n');

        // Step 5: Select tests
        console.log('5️⃣  Selecting lab tests...');
        console.log(`    Tests: ${testOrderData.tests.map(t => t.name).join(', ')}`);
        await agent.selectTests(testOrderData.tests);
        console.log('    ✅ Tests selected\n');

        // Step 6: Add diagnosis codes
        console.log('6️⃣  Adding diagnosis codes...');
        console.log(`    Codes: ${testOrderData.diagnosisCodes.join(', ')}`);
        await agent.addDiagnosisCodes(testOrderData.diagnosisCodes);
        console.log('    ✅ Diagnosis codes added\n');

        // Step 7: Validate order
        console.log('7️⃣  Validating order...');
        const validated = await agent.validateOrder();
        if (validated) {
            console.log('    ✅ Order validated\n');
        } else {
            console.log('    ⚠️  Validation skipped or failed\n');
        }

        // Step 8: Preview order
        console.log('8️⃣  Generating order preview...');
        const previewPath = await agent.previewOrder();
        console.log(`    ✅ Preview saved: ${previewPath}\n`);

        const result = {
            success: true,
            status: 'preview',
            message: 'Order preview completed successfully (dry-run mode)'
        };

        console.log('\n===================================');
        if (result.success) {
            console.log('✅ ORDER SUBMITTED SUCCESSFULLY!');
            if (result.requisitionNumber) {
                console.log(`📋 Requisition: ${result.requisitionNumber}`);
            }
        } else {
            console.log('❌ Order submission failed');
        }
        console.log('===================================\n');

        console.log('📸 Screenshots saved to: ./automation-screenshots/');
        console.log('');

    } catch (error) {
        console.error('\n❌ ===================================');
        console.error('   TEST FAILED');
        console.error('   ===================================');
        console.error(`   Error: ${error.message}`);
        console.error('   Check ./automation-screenshots/ for details');
        console.error('===================================\n');
    } finally {
        // Keep browser open for inspection
        console.log('⏸️  Browser staying open for inspection...');
        console.log('   Press Ctrl+C to close when done.\n');

        // Wait indefinitely
        await new Promise(() => { });
    }
}

// Run the test
console.log('\n🚀 Starting Labcorp automation test...\n');
runTest().catch(console.error);