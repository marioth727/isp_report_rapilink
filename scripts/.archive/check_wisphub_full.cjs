const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;
const targets = ['62779', '63003'];
const domains = ['api.wisphub.io', 'api.wisphub.net'];

async function checkWispHub() {
    console.log('--- CHECKING WHISPHUB STATUS WITH MULTIPLE DOMAINS ---');
    console.log('Using API Key starts with:', apiKey.substring(0, 5));

    for (const domain of domains) {
        console.log(`\nDomain: ${domain}`);
        for (const id of targets) {
            try {
                const res = await fetch(`https://${domain}/api/tickets/${id}/`, {
                    headers: { 'Authorization': `Api-Key ${apiKey}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    console.log(`[OK] TICKET ${id} | Técnico: ${data.nombre_tecnico} | Usuario: ${data.tecnico_usuario}`);
                } else {
                    console.log(`[FAIL] TICKET ${id} | Status: ${res.status}`);
                    // if (res.status === 403) {
                    //    const text = await res.text();
                    //    console.log(`  Details: ${text.substring(0, 100)}`);
                    // }
                }
            } catch (e) {
                console.log(`[ERROR] TICKET ${id} | ${e.message}`);
            }
        }
    }
}

checkWispHub();
