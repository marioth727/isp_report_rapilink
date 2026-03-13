const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: proc } = await supabase.from('workflow_processes').select('id, metadata').eq('reference_id', '62779').single();
    if (!proc) return console.log('Process not found');
    console.log('Process:', proc.id, 'TechMetadata:', proc.metadata?.technician_name);

    const { data: acts } = await supabase.from('workflow_activities').select('id, name, status, workflow_workitems(*)').eq('process_id', proc.id);
    acts.forEach(a => {
        console.log(`ACT: ${a.name} | STATUS: ${a.status}`);
        a.workflow_workitems.forEach(wi => {
            console.log(`  WI: ${wi.id} | STATUS: ${wi.status} | PARTICIPANT: ${wi.participant_id}`);
        });
    });

    const { data: profiles } = await supabase.from('profiles').select('wisphub_id, full_name').or(`wisphub_id.eq.sistemas@rapilink-sas,full_name.ilike.%Mario%`);
    console.log('Relevant Profiles:', JSON.stringify(profiles, null, 2));
}
run();
