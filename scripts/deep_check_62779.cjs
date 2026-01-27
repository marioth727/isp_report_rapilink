const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function deepCheck62779() {
    console.log('--- Deep Check for Ticket 62779 ---');

    // 1. Obtener el workitem PE
    const { data: workItems } = await supabase
        .from('workflow_workitems')
        .select('*')
        .eq('status', 'PE')
        .ilike('participant_id', '%1153b433%');

    console.log('WorkItems matching ID:', JSON.stringify(workItems, null, 2));

    if (workItems && workItems.length > 0) {
        for (const wi of workItems) {
            console.log(`Checking Activity ${wi.activity_id}...`);
            const { data: activity } = await supabase
                .from('workflow_activities')
                .select('*, workflow_processes(*)')
                .eq('id', wi.activity_id)
                .maybeSingle();

            console.log('Activity & Process Data:', JSON.stringify(activity, null, 2));
        }
    }
}

deepCheck62779();
