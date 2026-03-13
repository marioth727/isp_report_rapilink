const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function check62779() {
    console.log('--- Checking Ticket 62779 explicitly ---');

    // 1. Proceso
    const { data: process } = await supabase
        .from('workflow_processes')
        .select('*, workflow_activities(*, workflow_workitems(*))')
        .eq('reference_id', '62779')
        .maybeSingle();

    if (!process) {
        console.log('Process 62779 NOT found');
        return;
    }

    console.log('Process found:', process.id);
    console.log('Metadata Technician:', process.metadata?.technician_name);

    const activeActivities = process.workflow_activities?.filter(a => a.status === 'Active');
    console.log('Active Activities Count:', activeActivities?.length);

    for (const act of activeActivities || []) {
        const pes = act.workflow_workitems?.filter(wi => wi.status === 'PE');
        console.log(`Activity ${act.name} has ${pes?.length} PE workitems`);
        for (const wi of pes || []) {
            console.log(` - PE WorkItem ID: ${wi.id}, Participant: ${wi.participant_id}`);
        }
    }
}

check62779();
