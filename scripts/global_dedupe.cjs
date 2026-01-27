const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function globalDedupe() {
    console.log('--- GLOBAL DEDUPLICATION START ---');

    // 1. Find all processes with more than one Active activity
    const { data: processes } = await supabase.from('workflow_processes').select('id, reference_id').eq('status', 'PE');

    for (const proc of processes) {
        const { data: acts } = await supabase
            .from('workflow_activities')
            .select('id, name, status, created_at')
            .eq('process_id', proc.id)
            .eq('status', 'Active')
            .order('created_at', { ascending: false });

        if (acts && acts.length > 1) {
            console.log(`[!] Process ${proc.reference_id} has ${acts.length} active activities. Keeping newest.`);
            const [keep, ...discard] = acts;

            for (const d of discard) {
                console.log(`    -> Cancelling stale activity: ${d.name} (${d.id})`);
                await supabase.from('workflow_activities').update({ status: 'Completed' }).eq('id', d.id);
                await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('activity_id', d.id).eq('status', 'PE');
            }
        }
    }

    // 2. Clean duplicate workitems for the same user in the same activity
    const { data: pendingWIs } = await supabase
        .from('workflow_workitems')
        .select('id, activity_id, participant_id')
        .eq('status', 'PE');

    const seen = new Set();
    for (const wi of pendingWIs) {
        const key = `${wi.activity_id}-${wi.participant_id}`;
        if (seen.has(key)) {
            console.log(`[!] Duplicate WorkItem for user ${wi.participant_id} in activity ${wi.activity_id}. Cancelling.`);
            await supabase.from('workflow_workitems').update({ status: 'CA' }).eq('id', wi.id);
        } else {
            seen.add(key);
        }
    }

    console.log('--- GLOBAL DEDUPLICATION DONE ---');
}

globalDedupe();
