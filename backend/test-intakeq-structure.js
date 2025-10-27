require('dotenv').config();

async function test() {
    const response = await fetch('https://intakeq.com/api/v1/clients', {
        headers: { 'X-Auth-Key': process.env.INTAKEQ_API_KEY }
    });
    const data = await response.json();
    console.log('Response type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Keys:', Object.keys(data));
    console.log('Clients count:', data.Clients ? data.Clients.length : 'N/A');
    if (data.Clients && data.Clients.length > 0) {
        console.log('First client:', data.Clients[0]);
    }
}
test();
