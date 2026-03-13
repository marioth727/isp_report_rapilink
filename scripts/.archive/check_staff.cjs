const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkStaff() {
    const apiKey = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;
    console.log('Using API Key:', apiKey ? apiKey.substring(0, 5) + '...' : 'NONE');

    try {
        const response = await fetch(`https://api.wisphub.net/api/staff/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await response.json();
        console.log('Staff response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
checkStaff();
