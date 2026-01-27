const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function findStaff1425025() {
    const apiKey = process.env.VITE_WISPHUB_API_KEY;
    const response = await fetch('https://api.wisphub.net/api/staff/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const data = await response.json();

    const target = data.results.find(s => String(s.id) === '1425025');
    console.log('--- Target Staff (1425025) ---');
    console.log(JSON.stringify(target, null, 2));
}

findStaff1425025();
