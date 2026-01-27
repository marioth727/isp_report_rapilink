
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function check() {
    console.log("Fetching Ticket 63003 directly...");
    const res = await fetch('https://api.wisphub.io/api/tickets/63003/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const t = await res.json();
    console.log("NOMBRE TECNICO:", t.nombre_tecnico);
    console.log("TECNICO (RAW):", t.tecnico);
    console.log("ESTADO:", t.estado);
}
check();
