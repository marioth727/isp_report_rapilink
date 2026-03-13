const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fetch = require('node-fetch');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

async function diagnose() {
    console.log('--- DIAGNOSING SYNC LOGIC for 63003 ---');

    // 1. Fetch profiles
    const { data: profiles } = await supabase.from('profiles').select('*');

    // 2. Fetch ticket from WispHub
    const r = await fetch('https://api.wisphub.io/api/tickets/63003/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const ticketRaw = await r.json();

    // 3. Map ticket (simulating mapTicket in wisphub.ts)
    const t = {
        nombre_tecnico: ticketRaw.nombre_tecnico ||
            (ticketRaw.tecnico && typeof ticketRaw.tecnico === 'object' ? ticketRaw.tecnico.nombre : ticketRaw.tecnico) ||
            "Sin asignar",
        tecnico_usuario: ticketRaw.tecnico_usuario ||
            (ticketRaw.tecnico && typeof ticketRaw.tecnico === 'object' ? ticketRaw.tecnico.usuario : null) ||
            (ticketRaw.email_tecnico ? ticketRaw.email_tecnico.split('@')[0] : null),
        email_tecnico: ticketRaw.email_tecnico || (ticketRaw.tecnico && typeof ticketRaw.tecnico === 'object' ? ticketRaw.tecnico.email : null),
    };

    console.log('Mapped Ticket Fields:', JSON.stringify(t, null, 2));

    // 4. Run matching logic
    const isMatch = (t, profile) => {
        const norm = (s) => (s || '').toString().toLowerCase().trim();
        const pWhId = norm(profile.wisphub_id);
        const pEmail = norm(profile.email);
        const pName = norm(profile.full_name);

        const tUser = norm(t.tecnico_usuario || '');
        const tName = norm(t.nombre_tecnico || '');
        const tEmail = norm(t.email_tecnico || '');

        if (!pWhId && !pEmail && !pName) return false;

        console.log(`Checking match for [${profile.full_name}] vs [${tName} / ${tUser}]`);

        if (tName && pName && (tName === pName || tName.includes(pName) || pName.includes(tName))) {
            if (tName.length > 5 && pName.length > 5) {
                console.log(`  MATCH by Name!`);
                return true;
            }
        }

        const pBase = pWhId.split('@')[0].replace(/s$/, '');
        const tBase = tUser.split('@')[0].replace(/s$/, '');
        if (pBase && tBase && pBase === tBase && pBase.length > 3) {
            console.log(`  MATCH by Root (${pBase})!`);
            return true;
        }

        if (tEmail && pEmail && tEmail === pEmail) {
            console.log(`  MATCH by Email!`);
            return true;
        }

        if (tUser && pWhId && tUser === pWhId) {
            console.log(`  MATCH by UserID!`);
            return true;
        }

        if (tName.includes('alejandra') && pWhId.includes('maira.vasquez')) return true;

        return false;
    };

    const matchedUser = profiles.find(p => isMatch(t, p));
    console.log('FINAL MATCHED USER:', matchedUser ? matchedUser.full_name : 'NONE');

}

diagnose();
