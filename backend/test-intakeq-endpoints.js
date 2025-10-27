// Test different IntakeQ API endpoints
require('dotenv').config();

async function testEndpoints() {
    console.log('Testing IntakeQ API endpoints...');
    console.log('API Key:', process.env.INTAKEQ_API_KEY ? `${process.env.INTAKEQ_API_KEY.substring(0, 10)}...` : 'NOT SET');

    const endpoints = [
        'https://intakeq.com/api/v1/clients',
        'https://intakeq.com/api/v1/client',
        'https://intakeq.com/api/v1/clients/search',
        'https://intakeq.com/api/v2/clients',
        'https://intakeq.com/api/v2/clients/search',
        'https://api.intakeq.com/v1/clients',
        'https://api.intakeq.com/v1/clients/search',
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n📍 Testing: ${endpoint}`);

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'X-Auth-Key': process.env.INTAKEQ_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers.get('content-type')}`);

            if (response.ok) {
                const text = await response.text();
                if (response.headers.get('content-type')?.includes('application/json')) {
                    const data = JSON.parse(text);
                    console.log(`   ✅ SUCCESS! Response type: ${typeof data}`);
                    if (Array.isArray(data)) {
                        console.log(`   Found ${data.length} items`);
                        if (data.length > 0) {
                            console.log(`   First item keys:`, Object.keys(data[0]).join(', '));
                        }
                    } else {
                        console.log(`   Response keys:`, Object.keys(data).join(', '));
                    }
                } else {
                    console.log(`   ⚠️  Non-JSON response (${text.substring(0, 100)}...)`);
                }
            } else {
                console.log(`   ❌ Error status: ${response.status}`);
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
}

testEndpoints();
