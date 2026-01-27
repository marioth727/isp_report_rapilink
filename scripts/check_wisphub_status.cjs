const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY;
const targets = ['62779', '63003'];

async function checkWispHub() {
    console.log('--- CHECKING WHISPHUB STATUS ---');
    for (const id of targets) {
        try {
            const res = await fetch(`https://api.wisphub.net/api/tickets/${id}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });
            if (!res.ok) {
                console.log(`Error fetching ticket ${id}: ${res.status}`);
                continue;
            }
            const data = await res.json();
            console.log(`TICKET ${id} | Técnico: ${data.nombre_tecnico} | Usuario: ${data.tecnico_usuario} | Estado: ${data.id_estado}`);
        } catch (e) {
            console.log(`Failed for ${id}: ${e.message}`);
        }
    }
}

checkWispHub();
