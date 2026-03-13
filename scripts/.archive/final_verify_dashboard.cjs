const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function finalCheck() {
    const marioId = 'fef7cda2-4c87-4eed-aad8-4088099dbf61';
    const alejandraId = '4a00f8e6-9323-4d69-b7f9-d8ff405b333b';

    const { data: Mario } = await supabase
        .from('workflow_workitems')
        .select('id, workflow_activities!inner(name, workflow_processes!inner(reference_id))')
        .eq('participant_id', marioId)
        .eq('status', 'PE');

    const { data: Alejandra } = await supabase
        .from('workflow_workitems')
        .select('id, workflow_activities!inner(name, workflow_processes!inner(reference_id))')
        .eq('participant_id', alejandraId)
        .eq('status', 'PE');

    console.log('--- FINAL DASHBOARD STATE ---');
    console.log('Mario Pending:', Mario.map(wi => `${wi.workflow_activities.workflow_processes.reference_id} (${wi.workflow_activities.name})`));
    console.log('Alejandra Pending:', Alejandra.map(wi => `${wi.workflow_activities.workflow_processes.reference_id} (${wi.workflow_activities.name})`));
    console.log('------------------------------');
}

finalCheck();
