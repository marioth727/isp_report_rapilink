const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    const targets = ['62779', '63003'];
    console.log('--- INSPECCIÓN DE ESTADO ACTUAL EN BASE DE DATOS ---');

    for (const ref of targets) {
        const { data: proc } = await s.from('workflow_processes').select('id, metadata, status').eq('reference_id', ref).single();
        if (proc) {
            console.log(`\nTICKET ${ref} (Process ID: ${proc.id})`);
            console.log(`  Process Status: ${proc.status}`);
            console.log(`  Metadata Tech: ${proc.metadata?.technician_name}`);

            const { data: wis } = await s.from('workflow_workitems')
                .select('id, participant_id, status, created_at, workflow_activities!inner(process_id, name)')
                .eq('workflow_activities.process_id', proc.id);

            console.log(`  WorkItems (${wis.length}):`);
            wis.forEach(wi => {
                console.log(`    * ID: ${wi.id} | Part: ${wi.participant_id} | Status: ${wi.status} | Act: ${wi.workflow_activities.name}`);
            });
        } else {
            console.log(`\nTICKET ${ref} NOT FOUND IN DB`);
        }
    }

    // Identificar perfil de Mario
    const { data: profile } = await s.from('profiles').select('*').ilike('full_name', '%Mario%').maybeSingle();
    console.log('\n--- PERFIL DE MARIO ---');
    console.log(JSON.stringify(profile, null, 2));
}

inspect();
