
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function checkTickets() {
    const ids = ['63003', '62779', '61416'];
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync('results_specific.txt', msg + '\n');
    };

    fs.writeFileSync('results_specific.txt', '');
    log(`\n🔍 Verificando asignación real en WispHub para: ${ids.join(', ')}...`);
    log("   ID      | ESTADO       | TECNICO (API)               | USUARIO (API)");
    log("   --------|--------------|-----------------------------|-------------------------");

    for (const id of ids) {
        try {
            const res = await fetch(`https://api.wisphub.io/api/tickets/${id}/`, {
                headers: { 'Authorization': `Api-Key ${apiKey}` }
            });

            if (!res.ok) {
                log(`   #${id}  | ERROR ${res.status}   | -                           | -`);
                continue;
            }

            const t = await res.json();

            // Resolve Name
            let techName = "Sin Asignar";
            let techUser = "N/A";

            if (t.nombre_tecnico) {
                techName = t.nombre_tecnico;
            } else if (t.tecnico) {
                if (typeof t.tecnico === 'string') techName = t.tecnico;
                else if (t.tecnico.nombre) techName = t.tecnico.nombre;
            }

            // Resolve User
            if (t.tecnico_usuario) techUser = t.tecnico_usuario;
            else if (t.tecnico && t.tecnico.username) techUser = t.tecnico.username;

            log(`   #${id}  | ${t.estado.padEnd(12)} | ${techName.padEnd(27)} | ${techUser}`);

        } catch (err) {
            console.error(`Error checking ${id}:`, err.message);
        }
    }
    log("\nNota: Si 'USUARIO (API)' es undefined, mi sistema busca el nombre en la lista de Staff.");
}

checkTickets();
