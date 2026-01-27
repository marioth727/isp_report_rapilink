const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    console.log('--- INSPECCIÓN DE DATOS ---');

    // 1. Perfiles
    const { data: profiles } = await s.from('profiles').select('*');
    console.log('Profiles Found:', profiles.length);
    profiles.forEach(p => {
        console.log(`- ${p.full_name} | Email: ${p.email} | WispHubID: ${p.wisphub_id} | SupabaseID: ${p.id}`);
    });

    // 2. Ticket 62779
    const { data: proc } = await s.from('workflow_processes').select('*').eq('reference_id', '62779').single();
    if (proc) {
        console.log('\n--- TICKET 62779 ---');
        console.log('Process ID:', proc.id);
        console.log('Metadata Tech:', proc.metadata?.technician_name);

        const { data: wis } = await s.from('workflow_workitems')
            .select('*, workflow_activities(name)')
            .eq('activity_id', '3df90d40-a6c3-4aaa-83e1-66fd4bac83a9') // Uno de los IDs que vi
            .eq('status', 'PE');

        console.log('WorkItems for this activity (ST):', wis.length);
        wis.forEach(wi => {
            console.log(`  * WI ID: ${wi.id} | Participant: ${wi.participant_id} | Status: ${wi.status}`);
        });

        // Buscar todos los workitems pendientes de este proceso
        const { data: allWis } = await s.from('workflow_workitems')
            .select('*, workflow_activities!inner(process_id, name)')
            .eq('workflow_activities.process_id', proc.id)
            .eq('status', 'PE');

        console.log('\nAll Pending WorkItems for Process 62779:', allWis.length);
        allWis.forEach(wi => {
            console.log(`  * Activity: ${wi.workflow_activities.name} | WI ID: ${wi.id} | Participant: ${wi.participant_id}`);
        });
    } else {
        console.log('Ticket 62779 not found');
    }
}
inspect();
