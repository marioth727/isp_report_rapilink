const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const apiKey = process.env.VITE_WISPHUB_API_KEY || process.env.WISPHUB_API_KEY;

// User to check
const TARGET_USERNAME = 'sistemas@rapilink-sas';
// We suspect the ID might be: fef7cda2-4c87-4eed-aad8-4088099dbf61 based on previous context (Mario/Sistemas) but let's resolve it dynamically.

async function compare() {
    console.log(`--- ANALYZING TICKETS FOR: ${TARGET_USERNAME} ---`);

    // 1. Resolve Local UUID
    const { data: profiles } = await supabase.from('profiles').select('*');
    const targetProfile = profiles.find(p => p.email === TARGET_USERNAME || p.wisphub_id === TARGET_USERNAME);

    if (!targetProfile) {
        console.error(`❌ Local Profile for ${TARGET_USERNAME} NOT FOUND.`);
        // Assuming Mario based on previous context, but let's list possibilities
        const mario = profiles.find(p => p.full_name?.toLowerCase().includes('mario'));
        if (mario) console.log(`Did you mean: ${mario.full_name} (${mario.email})? ID: ${mario.id}`);
        return;
    }
    const targetUUID = targetProfile.id;
    console.log(`✅ Participant Resolved: ${targetProfile.full_name} (ID: ${targetUUID})`);


    // 2. Fetch WispHub Tickets (Iterate to find them due to API limitations on filtering by tech username directly if not id)
    // Actually, let's just fetch recent tickets and filter by the tech username/email.
    console.log('Fetching WispHub tickets...');
    let whTickets = [];
    try {
        // Fetching last 200 tickets to be safe
        const res = await fetch(`https://api.wisphub.io/api/tickets/?limit=200&ordering=-id`, {
            headers: { 'Authorization': `Api-Key ${apiKey}` }
        });
        const data = await res.json();
        const allRecent = data.results || [];

        whTickets = allRecent.filter(t => {
            const techObj = t.tecnico;
            const techName = t.nombre_tecnico;
            const techUser = t.tecnico_usuario;

            // Check for match
            if (techUser === 'sistemas' || techUser === 'sistemas@rapilink-sas') return true;
            if (typeof techObj === 'object' && (techObj?.usuario === 'sistemas' || techObj?.email === 'sistemas@rapilink-sas')) return true;
            if (typeof techObj === 'string' && techObj.toLowerCase().includes('sistemas')) return true;
            // Also check Mario if they are the same person contextually
            if (techName && techName.toLowerCase().includes('mario')) return true;

            return false;
        }).map(t => ({
            id: t.id_ticket,
            state: t.estado,
            tech: t.nombre_tecnico || t.tecnico_usuario
        }));

    } catch (e) {
        console.error('Error fetching WispHub:', e.message);
    }
    console.log(`Found ${whTickets.length} tickets in WispHub assigned to 'sistemas' (or Mario):`);
    console.log(whTickets.map(t => `#${t.id} (${t.state})`));


    // 3. Fetch Local Tickets
    console.log('\nFetching Local WorkItems...');
    const { data: workItems } = await supabase
        .from('workflow_workitems')
        .select(`
            id, 
            status, 
            workflow_activities!inner (
                workflow_processes!inner (
                    reference_id,
                    metadata
                )
            )
        `)
        .eq('participant_id', targetUUID)
        .eq('status', 'PE'); // Only Pending? Or all? User said "que tiene asignado", usually implies active/pending.

    const localTickets = workItems.map(wi => ({
        id: wi.workflow_activities.workflow_processes.reference_id,
        status: wi.status,
        meta_tech: wi.workflow_activities.workflow_processes.metadata?.technician_name
    }));

    console.log(`Found ${localTickets.length} pending work items locally for ${targetProfile.full_name}:`);
    console.log(localTickets.map(t => `#${t.id}`));

    // 4. Comparison
    const whIds = new Set(whTickets.map(t => String(t.id)));
    const localIds = new Set(localTickets.map(t => String(t.id)));

    const inWhNotLocal = whTickets.filter(t => !localIds.has(String(t.id)));
    const inLocalNotWh = localTickets.filter(t => !whIds.has(String(t.id)));

    console.log('\n--- ANALYSIS RESULTS ---');
    console.log('MISSING LOCALLY (Problem):', inWhNotLocal.map(t => t.id));
    console.log('EXTRA LOCALLY (Stale?):', inLocalNotWh.map(t => t.id));

}

compare();
