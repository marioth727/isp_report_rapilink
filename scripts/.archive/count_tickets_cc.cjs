
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function countTickets() {
    const searchTerm = '000021';
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync('results_cc.txt', msg + '\n');
    };

    fs.writeFileSync('results_cc.txt', '');
    log(`\n🔍 Buscando tickets para el cliente/termino: "${searchTerm}" en WispHub...`);

    // Intentamos buscar usando el parámetro standard de búsqueda
    const res = await fetch(`https://api.wisphub.io/api/tickets/?search=${searchTerm}&limit=100`, {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });

    if (!res.ok) {
        log(`Error API: ${res.status}`);
        return;
    }

    const data = await res.json();
    const tickets = data.results || data || [];

    log(`\n📊 RESULTADOS:`);
    log(`   Se encontraron ${tickets.length} tickets.`);

    if (tickets.length > 0) {
        log("\n   ID      | ESTADO       | TECNICO ASIGNADO          | ASUNTO");
        log("   --------|--------------|---------------------------|-------------------------");
        tickets.forEach(t => {
            const techName = t.nombre_tecnico || (typeof t.tecnico === 'string' ? t.tecnico : t.tecnico?.nombre) || "Sin Asignar";
            log(`   #${t.id_ticket || t.id} | ${t.estado.padEnd(12)} | ${techName.padEnd(25)} | ${t.asunto || 'Sin Asunto'}`);
        });
    } else {
        log("\n   No se encontraron tickets con ese criterio.");
    }
    log("\nNOTA: Estos datos vienen directo de la API de WispHub (Fuente Oficial).");
}

countTickets();
