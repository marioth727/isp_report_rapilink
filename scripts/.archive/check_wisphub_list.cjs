const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function checkRecentTickets() {
    console.log('--- FETCHING RECENT TICKETS FROM WISPHUB ---');
    try {
        const res = await fetch('https://api.wisphub.io/api/tickets/?limit=20', {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        if (res.ok) {
            const data = await res.json();
            console.log('Total tickets:', data.count);
            data.results.forEach(t => {
                if (t.id === 62779 || t.id === 63003) {
                    console.log(`FOUND TICKET ${t.id}:`);
                    console.log(`  Asunto: ${t.asunto}`);
                    console.log(`  Técnico: ${t.nombre_tecnico} (${t.tecnico_usuario})`);
                    console.log(`  Estado: ${t.nombre_estado}`);
                }
            });
            // Also show first few tickets to see what's happening
            console.log('\nTop 5 latest tickets:');
            data.results.slice(0, 5).forEach(t => {
                console.log(`- ${t.id} | ${t.nombre_tecnico} | ${t.asunto}`);
            });
        } else {
            console.log(`Fail: ${res.status}`);
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

checkRecentTickets();
