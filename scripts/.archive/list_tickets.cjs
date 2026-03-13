const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listRecentTickets() {
    const apiKey = process.env.WISPHUB_API_KEY || process.env.VITE_WISPHUB_API_KEY;
    console.log('Using API Key:', apiKey ? apiKey.substring(0, 5) + '...' : 'NONE');

    console.log('Listing recent tickets...');
    try {
        const response = await fetch(`https://api.wisphub.net/api/tickets/?limit=5&ordering=-id`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await response.json();
        console.log('Total tickets:', data.count);
        console.log(JSON.stringify(data.results, null, 2));
    } catch (e) {
        console.error(e);
    }
}
listRecentTickets();
