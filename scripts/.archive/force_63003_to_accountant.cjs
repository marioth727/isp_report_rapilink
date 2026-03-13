require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function force() {
    const ticketId = '63003';
    const accountantId = '721cdde3-ed21-4018-bc04-c5429ee8247e';

    console.log(`Force updating ticket ${ticketId} to participant ${accountantId}`);

    const { data: proc } = await supabase.from('workflow_processes').select('id').eq('reference_id', ticketId).single();
    if (!proc) { console.error('E: Process not found'); return; }

    const { data: acts } = await supabase.from('workflow_activities').select('id').eq('process_id', proc.id).eq('status', 'Active');
    const actIds = acts.map(a => a.id);

    if (actIds.length > 0) {
        // Optimized update query
        const { error } = await supabase.from('workflow_workitems')
            .update({
                participant_id: accountantId,
                updated_at: new Date().toISOString()
            })
            .in('activity_id', actIds)
            .eq('status', 'PE');

        if (error) console.error('Update failed:', error.message);
        else console.log('Update successful');
    } else {
        console.log('No active activities for process', proc.id);
    }
}

force();
