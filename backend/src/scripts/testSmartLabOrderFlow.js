// Test Script for Smart Lab Order Flow
// Tests the entire integration: IntakeQ → Medicaid → Labcorp

require('dotenv').config();
const intakeqService = require('../services/intakeqService');
const medicaidEligibilityService = require('../services/medicaidEligibilityService');
const emailNotificationService = require('../services/emailNotificationService');

async function testIntakeQIntegration() {
    console.log('\n=== Testing IntakeQ Integration ===\n');

    try {
        // Test patient search
        console.log('1. Testing patient search...');
        const patients = await intakeqService.searchPatients('Test', 'Patient');
        console.log(`✅ Found ${patients.length} patient(s)`);

        if (patients.length > 0) {
            console.log('Sample patient:', patients[0]);
        }

    } catch (error) {
        console.error('❌ IntakeQ test failed:', error.message);
    }
}

async function testMedicaidEligibility() {
    console.log('\n=== Testing Medicaid Eligibility Check ===\n');

    try {
        // Test with Jeremy Montoya (known test patient)
        console.log('1. Checking eligibility for Jeremy Montoya...');
        const eligibility = await medicaidEligibilityService.checkEligibility({
            firstName: 'Jeremy',
            lastName: 'Montoya',
            dateOfBirth: '1984-07-17'
        });

        console.log('✅ Eligibility check completed');
        console.log('Eligible:', eligibility.isEligible);
        console.log('Traditional FFS:', eligibility.isTraditionalFFS);
        console.log('Plan Type:', eligibility.planType);

        if (eligibility.demographics) {
            console.log('\nDemographics:');
            console.log('Name:', `${eligibility.demographics.firstName} ${eligibility.demographics.lastName}`);
            console.log('DOB:', eligibility.demographics.dateOfBirth);

            if (eligibility.demographics.address) {
                console.log('Address:', eligibility.demographics.address);
                console.log('\n⭐ This address will be used to populate Labcorp (prevents corrections!)');
            }
        }

    } catch (error) {
        console.error('❌ Medicaid test failed:', error.message);
    }
}

async function testEmailNotification() {
    console.log('\n=== Testing Email Notification ===\n');

    try {
        console.log('1. Sending test failure notification...');

        const testFailureData = {
            providerName: 'Dr. Test Provider',
            patientData: {
                firstName: 'Test',
                lastName: 'Patient',
                dateOfBirth: '1990-01-15',
                medicaidId: 'UT123456789',
                phone: '555-1234',
                address: {
                    street: '123 Main St',
                    city: 'Salt Lake City',
                    state: 'UT',
                    zip: '84101'
                }
            },
            tests: [
                { code: '330015', name: 'Thyroid Cascade (TSH w/ Reflex to T3/T4)', category: 'Endocrine' },
                { code: '7065', name: 'Vitamin B12 and Folate', category: 'Vitamin' }
            ],
            diagnoses: ['F31.30', 'F33.1'],
            errorMessage: 'This is a test failure notification from the Smart Lab Order system',
            timestamp: new Date().toLocaleString()
        };

        const result = await emailNotificationService.sendAutomationFailureNotification(testFailureData);

        if (result) {
            console.log('✅ Email notification sent successfully');
            console.log('Check hello@trymoonlit.com for the test email');
        } else {
            console.log('⚠️  Email not configured or failed to send');
        }

    } catch (error) {
        console.error('❌ Email test failed:', error.message);
    }
}

async function testLabTestCodeMapping() {
    console.log('\n=== Testing Lab Test Code Mapping ===\n');

    try {
        const labTestCodes = require('../../config/labTestCodes.json');

        console.log('Common Tests Available:', labTestCodes.labcorp.commonTests.length);
        console.log('Diagnoses Available:', labTestCodes.icd10.psychiatryDiagnoses.length);

        // Check for new tests
        const newTests = [
            '330015', // Thyroid Cascade
            '7065',   // B12 + Folate
            '39092',  // Clozapine
            '7150'    // Thiamine
        ];

        console.log('\nVerifying new tests:');
        newTests.forEach(code => {
            const test = labTestCodes.labcorp.commonTests.find(t => t.code === code);
            if (test) {
                console.log(`✅ ${code}: ${test.name}`);
            } else {
                console.log(`❌ ${code}: NOT FOUND`);
            }
        });

    } catch (error) {
        console.error('❌ Lab test code test failed:', error.message);
    }
}

async function runAllTests() {
    console.log('\n🚀 MOONLIT Smart Lab Order System - Integration Tests\n');
    console.log('=' .repeat(60));

    await testLabTestCodeMapping();
    await testIntakeQIntegration();
    await testMedicaidEligibility();
    await testEmailNotification();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All tests completed!\n');
    console.log('Next steps:');
    console.log('1. Configure environment variables in backend/.env');
    console.log('2. Start backend: cd backend && npm run dev');
    console.log('3. Start frontend: cd frontend && npm start');
    console.log('4. Navigate to http://localhost:3000 and test the Smart Lab Order page');
    console.log('\n');
}

// Run tests
runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
