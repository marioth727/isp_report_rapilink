const fetch = require('node-fetch');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkStaff() {
    const apiKey = process.env.VITE_WISPHUB_API_KEY;
    const response = await fetch('https://api.wisphub.net/api/staff/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const data = await response.json();

    console.log('--- WispHub Staff ---');
    const marios = data.results.filter(s => s.nombre.toLowerCase().includes('mario') || s.usuario.toLowerCase().includes('sistemas'));
    console.log(JSON.stringify(marios, null, 2));
}

checkStaff();
