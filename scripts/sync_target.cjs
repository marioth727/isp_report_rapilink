
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

const s = createClient(supabaseUrl, supabaseKey);

// --- STAFF LOOKUP ---
const cleanNameForMatch = (n) => n ? n.toLowerCase().trim() : '';

async function getStaffMap() {
    const map = new Map();
    try {
        const res = await fetch('https://api.wisphub.io/api/staff/', {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        if (res.ok) {
            const data = await res.json();
            const results = data.results || data || [];
            results.forEach(staff => {
                if (staff.nombre) map.set(cleanNameForMatch(staff.nombre), staff);
                if (staff.usuario) map.set(cleanNameForMatch(staff.usuario), staff);
                if (staff.username) map.set(cleanNameForMatch(staff.username), staff);
            });
        }
    } catch (e) {
        console.error("Staff fetch error:", e);
    }
    return map;
}

async function run() {
    console.log("--- TARGETED SYNC: Ticket 62779 ---");

    const staffMap = await getStaffMap();
    console.log(`Loaded Staff Map with ${staffMap.size} entries.`);

    // 1. FETCH TARGET TICKET
    const tRes = await fetch('https://api.wisphub.io/api/tickets/62779/', {
        headers: { 'Authorization': `Api-Key ${apiKey}` }
    });

    if (!tRes.ok) {
        console.error("Error fetching ticket 62779");
        return;
    }

    const t = await tRes.json();
    const tickets = [t];

    console.log("Processing ticket 62779...");

    for (const ticket of tickets) {
        // --- LOGIC FROM final_clean_sync.cjs ---

        // A. Resolve Technician
        let whTechName = ticket.nombre_tecnico;
        if (!whTechName && ticket.tecnico) {
            if (typeof ticket.tecnico === 'string') whTechName = ticket.tecnico;
            else if (ticket.tecnico.nombre) whTechName = ticket.tecnico.nombre;
        }

        let whTechUser = ticket.tecnico_usuario;
        if (!whTechUser && ticket.tecnico && ticket.tecnico.username) {
            whTechUser = ticket.tecnico.username;
        }

        // STAFF MAP LOOKUP
        if (!whTechUser && whTechName) {
            const clean = cleanNameForMatch(whTechName);
            const found = staffMap.get(clean);
            if (found) whTechUser = found.usuario || found.username;
        }

        console.log(`Resolved Technician: ${whTechName} (User: ${whTechUser})`);

        // B. Find Supabase User
        let targetParticipantId = null;
        let matchedUser = null;

        if (whTechUser) {
            const { data: u } = await s.from('profiles')
                .select('id, wisphub_id, full_name')
                .or(`wisphub_id.eq.${whTechUser},email.eq.${whTechUser}`)
                .maybeSingle();
            matchedUser = u;
        }

        // Mario Fallback (Optional but kept for safety)
        if (!matchedUser && whTechName && cleanNameForMatch(whTechName).includes('mario')) {
            targetParticipantId = 'fef7cda2-4c87-4eed-aad8-4088099dbf61'; // Mario UUID
            console.log("-> Fallback match for Mario Vasquez");
        } else if (matchedUser) {
            targetParticipantId = matchedUser.id;
            console.log(`-> Matched DB User: ${matchedUser.full_name} (${matchedUser.id})`);
        }

        if (!targetParticipantId) {
            console.log("-> No participant matched. Skipping update/create.");
            continue;
        }

        // C. Update/Create Logic
        // SURGICAL FIX: Target known ID from duplicates check
        const knownProcId = '9314fd7e-4ccf-4cfd-ae3a-8669787e86e4';

        const { data: existingProcess } = await s.from('workflow_processes')
            .select('id, status, title')
            .eq('id', knownProcId)
            .maybeSingle();

        if (existingProcess) {
            console.log(`[UPDATE] Found Process ${existingProcess.id} (Title: ${existingProcess.title})`);

            // Check WorkItems
            const { data: wis } = await s.from('workflow_workitems')
                .select('id, participant_id, status')
                .eq('process_id', existingProcess.id)
                .neq('status', 'CA'); // active ones

            let foundMyWI = null;
            for (const wi of (wis || [])) {
                if (wi.participant_id === targetParticipantId) foundMyWI = wi;
                else {
                    // WRONG OWNER? Reassign!
                    console.log(`-> Reassigning WI ${wi.id} from ${wi.participant_id} to ${targetParticipantId}`);
                    await s.from('workflow_workitems').update({ participant_id: targetParticipantId }).eq('id', wi.id);
                    console.log("-> Reassignment Complete.");
                }
            }
        }
    }
}

run();
