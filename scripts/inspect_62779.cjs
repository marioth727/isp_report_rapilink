const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function inspectWorkItem62779() {
    console.log('--- Inspecting WorkItem for Ticket 62779 ---');

    // 1. Encontrar el proceso
    const { data: process } = await supabase
        .from('workflow_processes')
        .select('id, reference_id, metadata')
        .eq('reference_id', '62779')
        .maybeSingle();

    if (!process) {
        console.log('Process not found');
        return;
    }

    console.log('Process Metadata:', JSON.stringify(process.metadata, null, 2));

    // 2. Encontrar actividades y workitems
    const { data: items } = await supabase
        .from('workflow_workitems')
        .select('*, workflow_activities(name, status)')
        .eq('workflow_activities.process_id', process.id);

    console.log('WorkItems for this process:');
    console.log(JSON.stringify(items, null, 2));
}

inspectWorkItem62779();
