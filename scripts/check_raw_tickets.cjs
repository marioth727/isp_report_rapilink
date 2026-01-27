const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;
const targets = ['62779', '63003'];

async function checkRaw() {
    console.log('--- RAW TICKET INSPECTION ---');
    for (const id of targets) {
        try {
            const res = await fetch(`https://api.wisphub.io/api/tickets/${id}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`\n--- TICKET ${id} ---`);
                console.log(`Status Name: ${data.nombre_estado} | ID: ${data.id_estado}`);
                console.log(`Tech Name: ${data.nombre_tecnico} | User: ${data.tecnico_usuario}`);
                console.log(`Department: ${data.departamento}`);
                // console.log('Raw keys:', Object.keys(data).join(', '));
            } else {
                console.log(`\nTICKET ${id} FAILED: ${res.status}`);
            }
        } catch (e) {
            console.log(`\nTICKET ${id} ERROR: ${e.message}`);
        }
    }
}

checkRaw();
