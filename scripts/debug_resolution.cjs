
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

const fs = require('fs');

function log(msg) {
    console.log(msg);
    if (typeof msg === 'object') msg = JSON.stringify(msg, null, 2);
    fs.appendFileSync('debug_full.txt', msg + '\n');
}

async function debugResolution() {
    fs.writeFileSync('debug_full.txt', '');
    log("--- DEBUGGING USER RESOLUTION (Ticket 63337) ---");

    // 1. Fetch Staff
    log("1. Fetching Staff...");
    const staffRes = await fetch('https://api.wisphub.io/api/staff/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const staffData = await staffRes.json();
    const staffList = staffData.results || staffData || [];

    const staffMap = {};
    const cleanName = (n) => n ? n.toLowerCase().trim() : '';

    staffList.forEach(s => {
        if (s.nombre) {
            console.log(`   - Staff: "${s.nombre}" -> clean: "${cleanName(s.nombre)}" | User: ${s.usuario || s.username}`);
            staffMap[cleanName(s.nombre)] = s;
        }
    });

    // 2. Fetch Ticket
    const ticketId = '63337';
    console.log(`\n2. Fetching Ticket ${ticketId}...`);
    const tRes = await fetch(`https://api.wisphub.io/api/tickets/${ticketId}/`, {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });
    const ticket = await tRes.json();

    console.log("   Ticket Data:", JSON.stringify(ticket, null, 2));

    const techRaw = ticket.tecnico;
    const techName = ticket.nombre_tecnico;
    console.log(`   Tech Field: ${JSON.stringify(techRaw)}`);
    console.log(`   Nombre Tecnico: ${JSON.stringify(techName)}`);

    // 3. Resolve
    let whTechName = techName || techRaw || "Sin asignar";
    let whTechUser = ticket.tecnico_usuario || null;

    if (techRaw && typeof techRaw === 'object') {
        // ...
    } else if (typeof techRaw === 'string') {
        const key = cleanName(techRaw);
        console.log(`   Looking up key: "${key}"`);
        const resolved = staffMap[key];
        if (resolved) {
            console.log("   ✅ MATCHED in StaffMap:", resolved);
            whTechUser = resolved.usuario || resolved.username;
        } else {
            console.log("   ❌ FAILED to match in StaffMap.");
        }
    }

    // 4. Match Supabase
    const { data: profiles } = await s.from('profiles').select('*');
    const normalizeUser = (u) => u ? u.toLowerCase().trim() : '';

    const matchedUser = profiles.find(p => {
        // Replicating logic
        const pUser = normalizeUser(p.wisphub_id);
        if (whTechUser && pUser === normalizeUser(whTechUser)) {
            console.log(`   MATCH FOUND via Username: ${p.wisphub_id} === ${whTechUser}`);
            return true;
        }
        return false;
    });

    if (matchedUser) {
        console.log("✅ FINAL RESULT: Resolved to Supabase User:", matchedUser.email);
    } else {
        console.log("❌ FINAL RESULT: No Supabase user found.");
    }
}

debugResolution();
