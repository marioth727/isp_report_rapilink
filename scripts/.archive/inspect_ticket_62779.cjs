const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function checkTicket() {
    const ticketId = '62779';
    console.log(`--- 🕵️ INSPECTING TICKET ${ticketId} ---`);

    try {
        const res = await fetch(`https://api.wisphub.io/api/tickets/${ticketId}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });

        if (!res.ok) {
            console.error(`Status: ${res.status}`);
            console.error(await res.text());
            return;
        }

        const data = await res.json();

        console.log('\n--- RAW "TECNICO" DATA ---');
        console.log('nombre_tecnico:', JSON.stringify(data.nombre_tecnico));
        console.log('tecnico_usuario:', JSON.stringify(data.tecnico_usuario));
        console.log('email_tecnico:', JSON.stringify(data.email_tecnico));
        console.log('tecnico object:', JSON.stringify(data.tecnico, null, 2));

        console.log('\n--- FULL RAW DATA DUMP ---');
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

checkTicket();
