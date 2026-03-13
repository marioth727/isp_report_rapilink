
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function check() {
    console.log("Checking 63337...");
    const tRes = await fetch(`https://api.wisphub.io/api/tickets/63337/`, {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const t = await tRes.json();
    console.log("Estado:", t.estado);
    console.log("ID  Estado:", t.id_estado);
    console.log("Tecnico:", t.tecnico);
    console.log("Nombre Tecnico:", t.nombre_tecnico);
    console.log("Tecnico Usuario:", t.tecnico_usuario);
}
check();
