const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function auditTickets() {
    console.log('--- AUDITING WISPHUB TICKETS ---');
    try {
        const res = await fetch('https://api.wisphub.io/api/tickets/?limit=50&ordering=-id', {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await res.json();

        const states = {};
        const technicians = {};

        console.log(`Auditing ${data.results.length} tickets...`);

        data.results.forEach(t => {
            const sId = t.id_estado;
            const sName = t.nombre_estado || t.estado;
            states[sId] = states[sId] ? { count: states[sId].count + 1, name: sName } : { count: 1, name: sName };

            const tech = t.nombre_tecnico || t.tecnico;
            technicians[tech] = (technicians[tech] || 0) + 1;

            if (t.id === 62779 || t.id === 63003) {
                console.log(`\nTARGET TICKET ${t.id}:`);
                console.log(`  Estado: ${sName} (ID: ${sId})`);
                console.log(`  Técnico: ${tech} (${t.tecnico_usuario})`);
            }
        });

        console.log('\nState Distribution:');
        console.log(JSON.stringify(states, null, 2));

        console.log('\nTechnician Distribution:');
        console.log(JSON.stringify(technicians, null, 2));

    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

auditTickets();
