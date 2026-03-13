const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function verifySync62779() {
    console.log('--- Verifying 62779 Mapping and WorkItem ---');

    // 1. Check Process
    const { data: proc } = await supabase
        .from('workflow_processes')
        .select('*, workflow_activities(*, workflow_workitems(*))')
        .eq('reference_id', '62779')
        .maybeSingle();

    if (!proc) {
        console.log('Process 62779 not found');
        return;
    }

    console.log('Process Level:', proc.escalation_level);
    console.log('Saved Technician:', proc.metadata?.technician_name);

    proc.workflow_activities?.forEach(act => {
        act.workflow_workitems?.forEach(wi => {
            console.log(`Activity ${act.name} [${act.status}] -> WI ID: ${wi.id}, STATUS: ${wi.status}, PARTICIPANT: ${wi.participant_id}`);
        });
    });

    // 2. Check Profile Mario
    const { data: mario } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Mario%')
        .maybeSingle();

    console.log('Mario Profile wisphub_id:', mario?.wisphub_id);
}

verifySync62779();
