// Direct Office Ally test
require('dotenv').config();

async function testOfficeAlly() {
    const medicaidService = require('./src/services/medicaidEligibilityService');

    console.log('Testing Office Ally with Jeremy Montoya...');
    console.log('Username:', process.env.OFFICE_ALLY_USERNAME);
    console.log('Sender ID:', process.env.OFFICE_ALLY_SENDER_ID);

    try {
        const result = await medicaidService.checkEligibility({
            firstName: 'Jeremy',
            lastName: 'Montoya',
            dateOfBirth: '1984-07-17'
        });

        console.log('\n✅ SUCCESS!');
        console.log('Eligible:', result.isEligible);
        console.log('Traditional FFS:', result.isTraditionalFFS);
        console.log('Demographics:', result.demographics);

    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        console.error(error.stack);
    }
}

testOfficeAlly();
