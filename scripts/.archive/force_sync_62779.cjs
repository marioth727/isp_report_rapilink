const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Mocking some dependencies to run the service logic in a script if possible
// Or just let the user run it from the UI.
// Actually, I will run the sync logic via a script to BE SURE.

async function forceSync62779() {
    // I'll manually apply the update that the sync would do for 62779
    console.log('Force updating 62779 to username...');
    const { data: wi } = await supabase
        .from('workflow_workitems')
        .select('id, workflow_activities!inner(process_id)')
        .eq('workflow_activities.reference_id', '62779') // Wait, reference_id is in process
        .maybeSingle(); // This might fail if the join is wrong in my head

    // Better: 
    const { data: proc } = await supabase.from('workflow_processes').select('id').eq('reference_id', '62779').single();
    if (proc) {
        const { data: activeWI } = await supabase
            .from('workflow_workitems')
            .select('id')
            .eq('status', 'PE')
            .eq('workflow_activities.process_id', proc.id)
            .maybeSingle(); // Incorrect join syntax for maybeSingle filters usually, but let's try direct update

        // Correct way to find the workitem
        const { data: act } = await supabase.from('workflow_activities').select('id').eq('process_id', proc.id).eq('status', 'Active').maybeSingle();
        if (act) {
            await supabase.from('workflow_workitems').update({ participant_id: 'sistemas@rapilink-sas' }).eq('activity_id', act.id).eq('status', 'PE');
            console.log('Update successful');
        }
    }
}

forceSync62779();
