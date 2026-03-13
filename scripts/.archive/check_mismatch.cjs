const fetch = require('node-fetch');
require('dotenv').config();

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function checkMismatch() {
    const ticketIds = ['63003', '62779'];
    for (const id of ticketIds) {
        const res = await fetch(`https://api.wisphub.io/api/tickets/${id}/`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const t = await res.json();
        console.log(`--- Ticket ${id} ---`);
        console.log(`nombre_tecnico: "${t.nombre_tecnico}"`);
        console.log(`tecnico_usuario: "${t.tecnico_usuario}"`);
        console.log(`tecnico (raw):`, JSON.stringify(t.tecnico, null, 2));
    }
}

checkMismatch();
