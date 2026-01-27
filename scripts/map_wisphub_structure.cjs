const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function mapStructure() {
    console.log('--- MAPPING WISPHUB STRUCTURE ---');
    try {
        const id = '63003';
        const res = await fetch(`https://api.wisphub.io/api/tickets/${id}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await res.json();
        console.log(`\nKeys for Ticket ${id}:`, Object.keys(data).join(', '));

        // Let's find fields that look like "tecnico" or "estado"
        for (let key in data) {
            if (key.includes('tecnico') || key.includes('estado') || key.includes('user')) {
                console.log(`  ${key}:`, JSON.stringify(data[key]));
            }
        }

        // Check if there is a nested ticket object (common in WispHub API)
        if (data.ticket) {
            console.log('\nFound nested "ticket" object! Keys:', Object.keys(data.ticket).join(', '));
        }

    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

mapStructure();
