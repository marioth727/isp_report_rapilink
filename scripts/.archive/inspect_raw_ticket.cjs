const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function inspectRawTicket() {
    const ticketId = '62779';
    const apiKey = process.env.VITE_WISPHUB_API_KEY;

    console.log(`--- RAW JSON TICKET ${ticketId} ---`);
    try {
        const response = await fetch(`https://api.wisphub.net/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const ticket = await response.json();
        console.log(JSON.stringify(ticket, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

inspectRawTicket();
