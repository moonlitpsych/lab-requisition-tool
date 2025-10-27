// Direct IntakeQ API test
require('dotenv').config();

async function testIntakeQ() {
    console.log('Testing IntakeQ API...');
    console.log('API Key:', process.env.INTAKEQ_API_KEY ? `${process.env.INTAKEQ_API_KEY.substring(0, 10)}...` : 'NOT SET');

    const baseUrl = 'https://intakeq.com/api/v1';

    try {
        // Test 1: Try searching for a patient
        console.log('\n1. Testing patient search...');
        const searchUrl = `${baseUrl}/clients/search?firstName=Test`;

        console.log('URL:', searchUrl);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Auth-Key': process.env.INTAKEQ_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('Response body (first 500 chars):', responseText.substring(0, 500));

        if (response.ok) {
            try {
                const data = JSON.parse(responseText);
                console.log('\n✅ SUCCESS! Found', data.length, 'patients');
                if (data.length > 0) {
                    console.log('Sample patient:', data[0]);
                }
            } catch (e) {
                console.log('\n⚠️  Got response but not JSON:', e.message);
            }
        } else {
            console.log('\n❌ API returned error status:', response.status);
        }

    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
        console.error(error.stack);
    }
}

testIntakeQ();
